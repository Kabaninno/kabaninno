import { describe, expect, it } from 'vitest';
import { emptyDraft, type ConfiguratorDraft } from './draft';
import { GOAL_UNSURE, getConfiguratorModel, isTelegramService } from './model';
import { categoriesOf, recommendedServices, selectedServices } from './recommend';

const model = getConfiguratorModel();

const draftWith = (patch: Partial<ConfiguratorDraft>): ConfiguratorDraft => ({
  ...emptyDraft(),
  ...patch,
});

describe('recommendedServices', () => {
  it('maps one goal and its answer to the services of the brief (D149)', () => {
    const draft = draftWith({ goals: ['more-clients'], answers: { 'more-clients': 'google' } });
    expect(recommendedServices(model, draft)).toEqual(['web/corporate-websites']);
  });

  it('recommends nothing before a goal is answered, for "unsure" and in manual mode', () => {
    expect(recommendedServices(model, emptyDraft())).toEqual([]);
    expect(recommendedServices(model, draftWith({ goals: ['booking'] }))).toEqual([]);
    expect(recommendedServices(model, draftWith({ goals: [GOAL_UNSURE] }))).toEqual([]);
    expect(
      recommendedServices(
        model,
        draftWith({ mode: 'manual', goals: ['booking'], answers: { booking: 'phone' } }),
      ),
    ).toEqual([]);
  });

  it('takes the services rank by rank across goals and counts duplicates once', () => {
    const draft = draftWith({
      goals: ['online-orders', 'booking', 'client-order'],
      answers: {
        'online-orders': 'over-200', // store, api-integrations
        booking: 'phone', // booking bot, notifications
        'client-order': 'spreadsheets', // crm, api-integrations (again)
      },
    });
    // First services of every goal, then the seconds; the repeated API integration counts once;
    // the limit of four cuts the last.
    expect(recommendedServices(model, draft)).toEqual([
      'web/online-stores',
      'telegram/booking',
      'crm/crm-implementation',
      'automation/api-integrations',
    ]);
  });

  it('never exceeds the limit', () => {
    const draft = draftWith({
      goals: ['fast-replies', 'booking', 'less-routine'],
      answers: {
        'fast-replies': 'many-channels',
        booking: 'website-inconvenient',
        'less-routine': 'documents',
      },
    });
    expect(recommendedServices(model, draft).length).toBeLessThanOrEqual(model.maxRecommended);
  });
});

describe('selectedServices', () => {
  const base = draftWith({
    goals: ['booking'],
    answers: { booking: 'phone' },
  });

  it('is the recommendation, in content order', () => {
    expect(selectedServices(model, base)).toEqual([
      'automation/notifications-reminders',
      'telegram/booking',
    ]);
  });

  it('drops what the visitor removed and adds what they picked', () => {
    const draft = {
      ...base,
      removed: ['telegram/booking'],
      added: ['web/landing-pages'],
    };
    expect(selectedServices(model, draft)).toEqual([
      'web/landing-pages',
      'automation/notifications-reminders',
    ]);
  });

  it('keeps picked services in the manual mode, where nothing is recommended', () => {
    const draft = draftWith({ mode: 'manual', added: ['crm/custom-crm', 'web/landing-pages'] });
    expect(selectedServices(model, draft)).toEqual(['web/landing-pages', 'crm/custom-crm']);
  });

  it('counts a service that is both recommended and picked once', () => {
    const draft = { ...base, added: ['telegram/booking'] };
    expect(selectedServices(model, draft)).toEqual([
      'automation/notifications-reminders',
      'telegram/booking',
    ]);
  });
});

describe('categoriesOf', () => {
  it('lists the categories of the services in content order, once each', () => {
    expect(
      categoriesOf(model, ['telegram/booking', 'web/landing-pages', 'telegram/sales-orders']),
    ).toEqual(['web', 'telegram']);
    expect(categoriesOf(model, [])).toEqual([]);
  });
});

describe('recommendations by locale (round 5, A2, D160)', () => {
  /** Every draft of up to `maxGoals` goals with every combination of their answers. */
  function* everyAnswer(locale?: string): Generator<ConfiguratorDraft> {
    const localized = getConfiguratorModel(locale);
    const goals = localized.goals;
    const subsets = (start: number, size: number): string[][] =>
      size === 0
        ? [[]]
        : goals
            .slice(start)
            .flatMap((goal, index) =>
              subsets(start + index + 1, size - 1).map((rest) => [goal.id, ...rest]),
            );
    for (let size = 1; size <= localized.maxGoals; size += 1) {
      for (const picked of subsets(0, size)) {
        const answerSets = picked.reduce<Record<string, string>[]>(
          (sets, goalId) =>
            sets.flatMap((answers) =>
              goals
                .find((goal) => goal.id === goalId)!
                .options.map((option) => ({ ...answers, [goalId]: option.id })),
            ),
          [{}],
        );
        for (const answers of answerSets) yield draftWith({ goals: picked, answers });
      }
    }
  }

  it.each(['pl', 'en'])('%s: no combination of answers leads to a Telegram service', (locale) => {
    const localized = getConfiguratorModel(locale);
    let count = 0;
    for (const draft of everyAnswer(locale)) {
      count += 1;
      const services = recommendedServices(localized, draft);
      expect(services.filter(isTelegramService), JSON.stringify(draft.answers)).toEqual([]);
      // Replacements never produce duplicates.
      expect(new Set(services).size).toBe(services.length);
    }
    // 1–3 of the 7 goals with every answer: 3 155 drafts.
    expect(count).toBe(3155);
  });

  it('uk: every combination gives what it gave before the change', () => {
    const uk = getConfiguratorModel('uk');
    let telegram = 0;
    for (const draft of everyAnswer('uk')) {
      const services = recommendedServices(uk, draft);
      expect(services).toEqual(recommendedServices(model, draft));
      if (services.some(isTelegramService)) telegram += 1;
    }
    expect(telegram).toBeGreaterThan(0);
  });

  it('the manual mode keeps Telegram services in every locale', () => {
    for (const locale of ['pl', 'en', 'uk']) {
      const localized = getConfiguratorModel(locale);
      const draft = draftWith({ mode: 'manual', added: ['telegram/booking'] });
      expect(selectedServices(localized, draft), locale).toEqual(['telegram/booking']);
    }
  });

  it('pl: the same answers as in uk, with the owner’s replacements', () => {
    const draft = draftWith({
      goals: ['booking', 'fast-replies'],
      answers: { booking: 'messengers', 'fast-replies': 'repeated-questions' },
    });
    expect(recommendedServices(getConfiguratorModel('uk'), draft)).toEqual([
      'telegram/booking',
      'ai/ai-assistants',
      'telegram/customer-support',
    ]);
    expect(recommendedServices(getConfiguratorModel('pl'), draft)).toEqual([
      'web/web-apps',
      'ai/ai-assistants',
      'automation/notifications-reminders',
    ]);
  });
});
