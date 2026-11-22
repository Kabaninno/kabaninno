import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { getCategory } from '~/content';
import enContent from '~/messages/en/content.json';
import enUi from '~/messages/en/ui.json';
import plContent from '~/messages/pl/content.json';
import plUi from '~/messages/pl/ui.json';
import ukContent from '~/messages/uk/content.json';
import ukUi from '~/messages/uk/ui.json';
import { CONFIGURATOR_STEPS } from '../configurator-steps';
import { buildWizardLabels, errorText, fillTemplate, type Translate } from './labels';
import { emptyDraft } from './draft';
import { formatTimeline } from './estimate';
import { buildLeadMessage } from './message';
import { GOAL_UNSURE, HAVE_NONE, OPTION_UNKNOWN, allServices, getConfiguratorModel } from './model';

const model = getConfiguratorModel();
const dictionaries = {
  pl: { ...plUi, ...plContent },
  en: { ...enUi, ...enContent },
  uk: { ...ukUi, ...ukContent },
} as const;

function labelsFor(locale: keyof typeof dictionaries) {
  const messages = dictionaries[locale];
  const translator = (namespace: 'configurator' | 'lead' | 'service') =>
    createTranslator({ locale, messages, namespace }) as unknown as Translate;
  const services = messages.services as Record<
    string,
    Record<string, { title: string; benefit: string }>
  >;
  return buildWizardLabels({
    locale,
    model,
    t: translator('configurator'),
    tLead: translator('lead'),
    tService: translator('service'),
    studio: 'KABANINNO',
    category: (id) => ({
      name: (messages.categories as Record<string, { name: string }>)[id]!.name,
      color: getCategory(id)!.dna.color,
    }),
    serviceTitle: (category, slug) => services[category]![slug]!.title,
    serviceBenefit: (category, slug) => services[category]![slug]!.benefit,
  });
}

describe('buildWizardLabels', () => {
  it.each(['pl', 'en', 'uk'] as const)('labels every option of the model (%s)', (locale) => {
    const labels = labelsFor(locale);
    for (const step of CONFIGURATOR_STEPS) {
      expect(labels.steps[step], step).toBeTruthy();
      expect(labels.titles[step], step).toBeTruthy();
      expect(labels.hints[step], step).toBeTruthy();
    }
    for (const category of model.categories) {
      expect(labels.categories[category]?.name).toBeTruthy();
    }
    for (const service of allServices(model)) {
      expect(labels.services[service.id], service.id).toBeTruthy();
      expect(labels.solution.benefits[service.id], service.id).toBeTruthy();
    }
    for (const goal of model.goals) {
      expect(labels.goals.names[goal.id], goal.id).toBeTruthy();
      expect(labels.details.questions[goal.id], goal.id).toBeTruthy();
      for (const option of goal.options) {
        expect(
          labels.details.options[goal.id]?.[option.id],
          `${goal.id}/${option.id}`,
        ).toBeTruthy();
      }
    }
    for (const id of model.have) expect(labels.details.have[id], id).toBeTruthy();
    for (const id of model.industries) expect(labels.industries[id]).toBeTruthy();
    for (const goal of model.goals) {
      expect(labels.lead.goalPhrases[goal.id], goal.id).toBeTruthy();
      for (const option of goal.options.filter((item) => item.id !== OPTION_UNKNOWN)) {
        expect(labels.lead.answers[goal.id]?.[option.id], `${goal.id}/${option.id}`).toMatch(
          /[.!?]$/,
        );
      }
    }
    expect(labels.goals.typical).toBeTruthy();
    expect(Object.values(labels.solution.estimate).every(Boolean)).toBe(true);
    expect(labels.summary.sendWhatsapp).toContain('WhatsApp');
    expect(labels.progress.guided).toHaveLength(CONFIGURATOR_STEPS.length);
    expect(labels.progress.manual).toHaveLength(CONFIGURATOR_STEPS.length - 1);
    // No leaked ICU arguments or message keys; the client-side templates keep their {name}.
    const stripped = JSON.stringify({
      ...labels,
      solution: { ...labels.solution, fits: '', removeNamed: '' },
      timeline: {},
      lead: {},
    });
    expect(stripped).not.toMatch(/\{\w+|configurator\.|lead\.|service\./);
    expect(labels.solution.fits).toContain('{combo}');
    expect(labels.solution.removeNamed).toContain('{service}');
    expect(labels.lead.picked).toMatch(/\{combo\}.*\{services\}/);
    expect(labels.lead.estimate).toMatch(/\{price\}.*\{timeline\}/);
    expect(labels.timeline.days[5]).toContain('{min}');
    // Every number the estimate can reach has its phrase.
    expect(Object.keys(labels.timeline.weeks).length).toBeGreaterThanOrEqual(24);
  });

  it('the goal "I don’t know" option shares one wording; the limit is in the hint', () => {
    const pl = labelsFor('pl');
    for (const goal of model.goals) {
      expect(pl.details.options[goal.id]![OPTION_UNKNOWN]).toBe(
        plUi.configurator.goals.unknownOption,
      );
    }
    expect(pl.goals.hint).toBe('Wybierz do 3.');
    expect(labelsFor('uk').goals.hint).toBe('Оберіть до 3.');
  });

  it('takes service names and benefits from content', () => {
    const labels = labelsFor('pl');
    const web = (
      plContent.services as Record<string, Record<string, { title: string; benefit: string }>>
    ).web!['landing-pages']!;
    expect(labels.services['web/landing-pages']).toBe(web.title);
    expect(labels.solution.benefits['web/landing-pages']).toBe(web.benefit);
  });

  it('formats progress, limits and the message title per locale', () => {
    expect(labelsFor('pl').progress.guided[2]).toBe('Krok 3 z 5');
    expect(labelsFor('uk').progress.guided[4]).toBe('Крок 5 з 5');
    expect(labelsFor('pl').progress.manual[3]).toBe('Krok 4 z 4');
    expect(labelsFor('pl').errors.nameTooShort).toBe('Wpisz co najmniej 2 znaki.');
    expect(labelsFor('pl').errors.commentTooLong).toBe('Maksymalnie 1000 znaków.');
    expect(labelsFor('en').errors.nameTooLong).toBe('Up to 80 characters.');
    expect(labelsFor('uk').lead.intro).toBe('Хочу скористатися послугами KABANINNO.');
    expect(labelsFor('pl').lead.intro).toBe('Chcę skorzystać z usług KABANINNO.');
  });

  it('feeds the message generator with complete labels (pl, en, uk)', () => {
    const draft = {
      ...emptyDraft(),
      industry: 'food',
      goals: ['booking'],
      answers: { booking: 'phone' },
      have: ['website', 'tracking'],
      contact: { name: 'Łucja', comment: '' },
    };
    const services = ['telegram/booking', 'automation/notifications-reminders'];
    const estimate = { price: '1400–3500 zł', timeline: '5–10 dni' };
    const pl = buildLeadMessage(draft, services, labelsFor('pl').lead, { estimate });
    expect(pl).toMatch(/^Dzień dobry!\nMam na imię Łucja\. Chcę skorzystać z usług KABANINNO\./);
    expect(pl).toContain(plUi.configurator.goals.items.booking.sentences.phone);
    expect(pl).toContain('Orientacyjnie: 1400–3500 zł, 5–10 dni.');
    // Gender-neutral first person (B3): no "Chciałbym / Chciałabym".
    expect(pl).not.toMatch(/Chciałbym|Chciałabym/);
    const en = buildLeadMessage(draft, services, labelsFor('en').lead, { estimate });
    const uk = buildLeadMessage(draft, services, labelsFor('uk').lead, { estimate });
    expect(uk).toContain(
      `Мій бізнес: ${ukUi.configurator.industries.food.toLocaleLowerCase('uk')}.`,
    );
    expect(uk).toContain(ukUi.configurator.goals.items.booking.phrase);
    for (const text of [pl, en, uk]) {
      expect(text).not.toMatch(/undefined|\{\w+\}/);
      expect(text.split('\n').at(-1)).toMatch(/\?$/);
    }
    const consultation = buildLeadMessage(
      { ...draft, goals: [GOAL_UNSURE], answers: {}, have: [HAVE_NONE] },
      [],
      labelsFor('uk').lead,
    );
    expect(consultation).toContain(ukUi.lead.consultation);
    expect(consultation).toContain(ukUi.lead.haveNone);
  });

  it('no "netto" anywhere in the interface texts (round 3, B1)', () => {
    expect(JSON.stringify([plUi, enUi, ukUi])).not.toMatch(/netto|нетто|\bnet\b/i);
  });
});

describe('timeline phrases of the estimate', () => {
  it('days up to ten, weeks above, one number when the weeks round together', () => {
    expect(formatTimeline([2, 5], labelsFor('uk').timeline)).toBe('2–5 днів');
    expect(formatTimeline([10, 21], labelsFor('uk').timeline)).toBe('1–3 тижні');
    expect(formatTimeline([12, 16], labelsFor('uk').timeline)).toBe('2 тижні');
    expect(formatTimeline([5, 11], labelsFor('pl').timeline)).toBe('1–2 tygodnie');
    expect(formatTimeline([1, 3], labelsFor('en').timeline)).toBe('1–3 days');
    expect(formatTimeline([14, 30], labelsFor('en').timeline)).toBe('2–4 weeks');
  });
});

describe('fillTemplate', () => {
  it('fills known placeholders and leaves unknown ones visible', () => {
    expect(fillTemplate('Pasuje: {combo}', { combo: 'Web + CRM' })).toBe('Pasuje: Web + CRM');
    expect(fillTemplate('{a} i {b}', { a: 'x' })).toBe('x i {b}');
  });
});

describe('errorText', () => {
  const errors = labelsFor('pl').errors;

  it('maps validation codes to field-specific messages', () => {
    expect(errorText('goals', 'required', errors)).toBe(errors.requiredMulti);
    expect(errorText('answers.booking', 'required', errors)).toBe(errors.requiredOne);

    expect(errorText('contact.name', 'required', errors)).toBe(errors.requiredText);
    expect(errorText('contact.name', 'tooShort', errors)).toBe(errors.nameTooShort);
    expect(errorText('contact.name', 'tooLong', errors)).toBe(errors.nameTooLong);
    expect(errorText('contact.comment', 'tooLong', errors)).toBe(errors.commentTooLong);
    expect(errorText('industry', 'tooLong', errors)).toBe(errors.industryTooLong);
    expect(errorText('industry', 'unknown', errors)).toBe(errors.unknown);
  });
});
