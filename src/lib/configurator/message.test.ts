import { describe, expect, it } from 'vitest';
import { emptyDraft, type ConfiguratorDraft } from './draft';
import { buildLeadMessage, fitLeadMessage, type LeadLabels } from './message';
import { GOAL_UNSURE, HAVE_NONE } from './model';
import { telegramUrl } from './telegram';
import { whatsappUrl } from './whatsapp';

/** Label fixtures as the server resolves them from ui.json (uk, the owner's template). */
const uk: LeadLabels = {
  locale: 'uk',
  greeting: 'Доброго дня!',
  introName: 'Мене звати {name}.',
  intro: 'Хочу скористатися послугами KABANINNO.',
  business: 'Мій бізнес: {industry}.',
  improve: 'Хочу покращити: {goals}.',
  have: 'Що вже є: {items}.',
  haveNone: 'Сайту, соцмереж чи програми для обліку клієнтів поки немає.',
  picked: 'На сайті мені підібрали: {combo} — {services}.',
  estimate: 'Орієнтовно: {price}, {timeline}.',
  consultation: 'Поки не знаю, що саме потрібно, — хочу отримати консультацію.',
  closing: 'Чи можемо обговорити деталі?',
  goalPhrases: {
    'less-routine': 'роботу без зайвої рутини',
    'client-order': 'облік клієнтів і заявок',
  },
  answers: {
    'less-routine': {
      'data-transfer': 'Найбільше часу забирає перенесення даних між програмами.',
    },
    'client-order': { spreadsheets: 'Клієнтів і заявки зараз веду в Excel чи таблицях.' },
  },
  haveNames: { website: 'Сайт', social: 'Соцмережі', [HAVE_NONE]: 'Нічого з цього' },
  categories: { automation: 'Автоматизація', crm: 'CRM' },
  serviceNames: {
    'automation/api-integrations': 'Інтеграції через API',
    'crm/crm-implementation': 'Впровадження CRM',
  },
  industries: { retail: 'Торгівля', it: 'IT і технології', other: 'Інша галузь' },
};

const SERVICES = ['crm/crm-implementation', 'automation/api-integrations'];
const ESTIMATE = { price: '1600–4500 zł', timeline: '5–12 днів' };

function draft(overrides: Partial<ConfiguratorDraft> = {}): ConfiguratorDraft {
  return {
    ...emptyDraft(),
    industry: 'retail',
    goals: ['less-routine', 'client-order'],
    answers: { 'less-routine': 'data-transfer', 'client-order': 'spreadsheets' },
    have: ['website', 'social'],
    contact: { name: '  Олена  ', comment: 'Хочемо почати до весни.' },
    ...overrides,
  };
}

describe('buildLeadMessage (round 3, B3)', () => {
  it('writes the client’s own request after the owner’s template', () => {
    expect(buildLeadMessage(draft(), SERVICES, uk, { estimate: ESTIMATE })).toBe(
      [
        'Доброго дня!',
        'Мене звати Олена. Хочу скористатися послугами KABANINNO.',
        '',
        'Мій бізнес: торгівля.',
        'Хочу покращити: роботу без зайвої рутини, облік клієнтів і заявок.',
        'Найбільше часу забирає перенесення даних між програмами. Клієнтів і заявки зараз веду в Excel чи таблицях.',
        'Що вже є: сайт, соцмережі.',
        '',
        'На сайті мені підібрали: CRM + Автоматизація — Впровадження CRM, Інтеграції через API.',
        'Орієнтовно: 1600–4500 zł, 5–12 днів.',
        '',
        'Хочемо почати до весни.',
        '',
        'Чи можемо обговорити деталі?',
      ].join('\n'),
    );
  });

  it('leaves out every line without data', () => {
    const bare = buildLeadMessage(
      { ...emptyDraft(), mode: 'manual', added: SERVICES },
      SERVICES,
      uk,
    );
    expect(bare).toBe(
      [
        'Доброго дня!',
        'Хочу скористатися послугами KABANINNO.',
        '',
        'На сайті мені підібрали: CRM + Автоматизація — Впровадження CRM, Інтеграції через API.',
        '',
        'Чи можемо обговорити деталі?',
      ].join('\n'),
    );
    expect(bare).not.toMatch(/\{\w+\}/);
  });

  it('"not sure yet" (no services): one consultation sentence instead of the solution', () => {
    const text = buildLeadMessage(
      draft({ goals: [GOAL_UNSURE], answers: {}, have: [HAVE_NONE] }),
      [],
      uk,
      { estimate: null },
    );
    expect(text).toContain(uk.consultation);
    expect(text).toContain(uk.haveNone);
    expect(text).not.toContain('Хочу покращити');
    expect(text).not.toContain('На сайті мені підібрали');
    expect(text).not.toContain('Орієнтовно');
  });

  it('a "don’t know" answer adds no sentence', () => {
    const text = buildLeadMessage(
      draft({ answers: { 'less-routine': 'unknown', 'client-order': 'spreadsheets' } }),
      SERVICES,
      uk,
    );
    expect(text).not.toContain('перенесення даних');
    expect(text).toContain('Клієнтів і заявки зараз веду в Excel чи таблицях.');
  });

  it('the industry: lower-cased in the sentence, acronyms kept, own words for "other"', () => {
    expect(buildLeadMessage(draft({ industry: 'it' }), SERVICES, uk)).toContain(
      'Мій бізнес: IT і технології.',
    );
    expect(
      buildLeadMessage(
        draft({ industry: 'other', industryOther: ' Столярна  майстерня ' }),
        [],
        uk,
      ),
    ).toContain('Мій бізнес: Столярна майстерня.');
    expect(buildLeadMessage(draft({ industry: 'other', industryOther: '' }), [], uk)).not.toContain(
      'Мій бізнес',
    );
  });

  it('compact: no blank lines, no answer sentences and no "what we have"', () => {
    const text = buildLeadMessage(draft(), SERVICES, uk, {
      format: 'compact',
      estimate: ESTIMATE,
    });
    expect(text).not.toContain('\n\n');
    expect(text).not.toContain('Найбільше часу');
    expect(text).not.toContain('Що вже є');
    expect(text).toContain('Орієнтовно: 1600–4500 zł, 5–12 днів.');
    expect(text.split('\n').at(-1)).toBe(uk.closing);
  });
});

describe('fitLeadMessage', () => {
  const telegram = (text: string) => telegramUrl('studio_bot', text);

  it('keeps the full message when its link fits', () => {
    const fitted = fitLeadMessage(draft(), SERVICES, uk, {
      toUrl: telegram,
      estimate: ESTIMATE,
      maxUrlLength: 10_000,
    });
    expect(fitted).toMatchObject({ format: 'full', truncated: false });
    expect(fitted.text).toBe(buildLeadMessage(draft(), SERVICES, uk, { estimate: ESTIMATE }));
  });

  it('falls back to the compact format, then shortens the comment, then cuts the text', () => {
    const full = buildLeadMessage(draft(), SERVICES, uk, { estimate: ESTIMATE });
    const compact = buildLeadMessage(draft(), SERVICES, uk, {
      format: 'compact',
      estimate: ESTIMATE,
    });
    const compactFits = fitLeadMessage(draft(), SERVICES, uk, {
      toUrl: telegram,
      estimate: ESTIMATE,
      maxUrlLength: telegram(compact).length,
    });
    expect(telegram(full).length).toBeGreaterThan(telegram(compact).length);
    expect(compactFits).toEqual({ text: compact, format: 'compact', truncated: false });

    const shortComment = fitLeadMessage(draft(), SERVICES, uk, {
      toUrl: telegram,
      estimate: ESTIMATE,
      maxUrlLength: telegram(compact).length - 20,
    });
    expect(shortComment.truncated).toBe(true);
    expect(shortComment.text).toContain('…');
    expect(shortComment.text).toContain(uk.closing);

    const cut = fitLeadMessage(draft(), SERVICES, uk, {
      toUrl: telegram,
      estimate: ESTIMATE,
      maxUrlLength: 300,
    });
    expect(cut.truncated).toBe(true);
    expect(telegram(cut.text).length).toBeLessThanOrEqual(300);
  });

  it('works with any link: the WhatsApp one too', () => {
    const toUrl = (text: string) => whatsappUrl('48123456789', text);
    const fitted = fitLeadMessage(draft(), SERVICES, uk, {
      toUrl,
      estimate: ESTIMATE,
      maxUrlLength: 1200,
    });
    expect(toUrl(fitted.text).length).toBeLessThanOrEqual(1200);
  });
});
