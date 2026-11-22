import { describe, expect, it } from 'vitest';
import type { ConfiguratorDraft } from './draft';
import { buildLeadMessage, fitLeadMessage, type LeadLabels } from './message';
import { GOAL_UNSURE } from './model';
import { telegramUrl } from './telegram';

/** Label fixtures as the server resolves them from ui.json / content texts. */
const pl: LeadLabels = {
  title: 'Zapytanie ze strony KABANINNO',
  goals: 'Cele',
  have: 'Mamy już',
  solution: 'Rozwiązanie',
  services: 'Usługi',
  industry: 'Branża',
  budget: 'Budżet',
  timeline: 'Termin',
  name: 'Imię',
  comment: 'Komentarz',
  unsure: 'jeszcze nie wiem, proszę o poradę',
  consultation: 'do dobrania na bezpłatnej konsultacji',
  goalNames: {
    'online-orders': 'Przyjmować zamówienia i płatności online',
    'client-order': 'Porządek w klientach i zleceniach',
  },
  answers: {
    'online-orders': { '20-200': '20–200' },
    'client-order': { 'program-inconvenient': 'W programie, ale jest niewygodny' },
  },
  haveNames: { website: 'Stronę WWW', social: 'Media społecznościowe' },
  categories: { web: 'Strony i aplikacje', crm: 'CRM' },
  serviceNames: {
    'web/online-stores': 'Sklepy internetowe',
    'crm/custom-crm': 'CRM na zamówienie',
  },
  industries: { retail: 'Handel', other: 'Inna branża' },
  budgets: { '5000-10000': '5\u00A0000–10\u00A0000 PLN netto', 'not-sure': 'Jeszcze nie wiem' },
  timelines: { '1-3-months': '1–3 miesiące' },
};

const en: LeadLabels = {
  ...pl,
  title: 'Request from the KABANINNO website',
  goals: 'Goals',
  have: 'Already have',
  solution: 'Solution',
  services: 'Services',
  industry: 'Industry',
  budget: 'Budget',
  timeline: 'Timeline',
  name: 'Name',
  comment: 'Comment',
  unsure: 'not sure yet, please advise',
  consultation: 'to be chosen on a free consultation',
  goalNames: {
    'online-orders': 'Take orders and payments online',
    'client-order': 'Keep clients and orders in order',
  },
  answers: {
    'online-orders': { '20-200': '20–200' },
    'client-order': { 'program-inconvenient': 'In a program, but it is inconvenient' },
  },
  haveNames: { website: 'A website', social: 'Social media' },
  categories: { web: 'Web Development', crm: 'CRM' },
  serviceNames: { 'web/online-stores': 'Online Stores', 'crm/custom-crm': 'Custom CRM' },
  industries: { retail: 'Retail', other: 'Other industry' },
  budgets: { '5000-10000': 'PLN 5,000–10,000 net', 'not-sure': 'Not sure yet' },
  timelines: { '1-3-months': '1–3 months' },
};

const uk: LeadLabels = {
  ...pl,
  title: 'Запит із сайту KABANINNO',
  goals: 'Цілі',
  have: 'Уже є',
  solution: 'Рішення',
  services: 'Послуги',
  industry: 'Галузь',
  budget: 'Бюджет',
  timeline: 'Терміни',
  name: 'Ім’я',
  comment: 'Коментар',
  unsure: 'ще не знаю, прошу порадити',
  consultation: 'підібрати на безкоштовній консультації',
  goalNames: {
    'online-orders': 'Приймати замовлення й оплату онлайн',
    'client-order': 'Порядок із клієнтами й заявками',
  },
  answers: {
    'online-orders': { '20-200': '20–200' },
    'client-order': { 'program-inconvenient': 'У програмі, але вона незручна' },
  },
  haveNames: { website: 'Сайт', social: 'Соцмережі' },
  categories: { web: 'Веброзробка', crm: 'CRM' },
  serviceNames: { 'web/online-stores': 'Інтернет-магазини', 'crm/custom-crm': 'CRM на замовлення' },
  industries: { retail: 'Торгівля', other: 'Інша галузь' },
  budgets: { '5000-10000': '5\u202F000–10\u202F000 PLN нетто', 'not-sure': 'Ще не знаю' },
  timelines: { '1-3-months': '1–3 місяці' },
};

const SERVICES = ['web/online-stores', 'crm/custom-crm'];

function draft(comment = ''): ConfiguratorDraft {
  return {
    mode: 'guided',
    goals: ['online-orders', 'client-order'],
    answers: { 'online-orders': '20-200', 'client-order': 'program-inconvenient' },
    have: ['website', 'social'],
    removed: [],
    added: [],
    industry: 'retail',
    industryOther: '',
    budget: '5000-10000',
    timeline: '1-3-months',
    contact: { name: '  Zoë  Łukasiewicz ', comment },
  };
}

describe('buildLeadMessage', () => {
  it('pl, full format: readable blocks, Polish diacritics intact', () => {
    expect(buildLeadMessage(draft('Potrzebny sklep z integracją.\nPilne.'), SERVICES, pl)).toBe(
      [
        'Zapytanie ze strony KABANINNO',
        '',
        'Cele:',
        '• Przyjmować zamówienia i płatności online (20–200)',
        '• Porządek w klientach i zleceniach (W programie, ale jest niewygodny)',
        'Mamy już: Stronę WWW, Media społecznościowe',
        'Rozwiązanie: Strony i aplikacje + CRM',
        'Usługi:',
        '• Sklepy internetowe',
        '• CRM na zamówienie',
        'Branża: Handel',
        'Budżet: 5 000–10 000 PLN netto',
        'Termin: 1–3 miesiące',
        'Imię: Zoë Łukasiewicz',
        '',
        'Komentarz:',
        'Potrzebny sklep z integracją.\nPilne.',
      ].join('\n'),
    );
  });

  it('en and uk use only the given labels (Cyrillic intact)', () => {
    const english = buildLeadMessage(draft(), SERVICES, en);
    expect(english).toContain('Solution: Web Development + CRM');
    expect(english).toContain('Already have: A website, Social media');
    expect(english).not.toMatch(/[ąęłńóśźżА-я]/);

    const ukrainian = buildLeadMessage(
      draft('Потрібна інтеграція з Telegram, ґанок і їжак.'),
      SERVICES,
      uk,
    );
    expect(ukrainian.split('\n')[0]).toBe('Запит із сайту KABANINNO');
    expect(ukrainian).toContain('Рішення: Веброзробка + CRM');
    expect(ukrainian).toContain('Ім’я: Zoë Łukasiewicz');
    expect(ukrainian).toContain('Потрібна інтеграція з Telegram, ґанок і їжак.');
  });

  it('turns every no-break space into a plain space (D35)', () => {
    for (const labels of [pl, uk]) {
      expect(buildLeadMessage(draft('a\u00A0b'), SERVICES, labels)).not.toMatch(
        /[\u00A0\u202F\u2007]/,
      );
    }
    expect(buildLeadMessage(draft(), SERVICES, uk)).toContain('Бюджет: 5 000–10 000 PLN нетто');
  });

  it('compact format: one line per section, comment collapsed', () => {
    expect(buildLeadMessage(draft('Pilne.\n\nBardzo.'), SERVICES, pl, { format: 'compact' })).toBe(
      [
        'Zapytanie ze strony KABANINNO',
        'Cele: Przyjmować zamówienia i płatności online (20–200); Porządek w klientach i zleceniach (W programie, ale jest niewygodny)',
        'Mamy już: Stronę WWW, Media społecznościowe',
        'Rozwiązanie: Strony i aplikacje + CRM',
        'Usługi: Sklepy internetowe, CRM na zamówienie',
        'Branża: Handel',
        'Budżet: 5 000–10 000 PLN netto · Termin: 1–3 miesiące',
        'Imię: Zoë Łukasiewicz',
        'Komentarz: Pilne. Bardzo.',
      ].join('\n'),
    );
  });

  it('"not sure yet" and no services: the consultation takes the place of the solution', () => {
    const unsure: ConfiguratorDraft = {
      ...draft(),
      goals: [GOAL_UNSURE],
      answers: {},
      have: [],
      industry: null,
      timeline: null,
      budget: 'not-sure',
      contact: { name: 'Ola', comment: '' },
    };
    const text = buildLeadMessage(unsure, [], pl);
    expect(text).toBe(
      [
        'Zapytanie ze strony KABANINNO',
        '',
        'Cele:',
        '• jeszcze nie wiem, proszę o poradę',
        'Rozwiązanie: do dobrania na bezpłatnej konsultacji',
        'Budżet: Jeszcze nie wiem',
        'Imię: Ola',
      ].join('\n'),
    );
  });

  it('the manual mode has no goals block; "other" industry prints the visitor’s words', () => {
    const manual: ConfiguratorDraft = {
      ...draft(),
      mode: 'manual',
      goals: [],
      answers: {},
      have: [],
      added: SERVICES,
      industry: 'other',
      industryOther: '  Stolarnia   artystyczna ',
    };
    const text = buildLeadMessage(manual, SERVICES, pl);
    expect(text).not.toContain('Cele');
    expect(text).toContain('Branża: Stolarnia artystyczna');
    const bare = buildLeadMessage({ ...manual, industryOther: '' }, SERVICES, pl);
    expect(bare).toContain('Branża: Inna branża');
  });

  it('skips unanswered sections and never prints "undefined" for unknown ids', () => {
    const partial: ConfiguratorDraft = {
      ...draft(),
      goals: ['mystery'],
      answers: { mystery: 'x' },
      have: ['ghost'],
      industry: null,
      budget: 'not-sure',
      timeline: null,
      contact: { name: '', comment: '' },
    };
    const text = buildLeadMessage(partial, ['ai/ghost-service'], pl);
    expect(text).toBe(
      [
        'Zapytanie ze strony KABANINNO',
        '',
        'Cele:',
        '• mystery (x)',
        'Mamy już: ghost',
        'Rozwiązanie: ai',
        'Usługi:',
        '• ai/ghost-service',
        'Budżet: Jeszcze nie wiem',
      ].join('\n'),
    );
    expect(text).not.toContain('undefined');
  });
});

describe('fitLeadMessage', () => {
  const username = 'kabaninno_studio';

  it('keeps the full format when it fits', () => {
    const fitted = fitLeadMessage(draft('Krótki komentarz.'), SERVICES, pl, { username });
    expect(fitted).toEqual({
      text: buildLeadMessage(draft('Krótki komentarz.'), SERVICES, pl),
      format: 'full',
      truncated: false,
    });
  });

  it('switches to the compact format before touching the comment', () => {
    const comment = 'Потрібна інтеграція з CRM. '.repeat(8);
    const full = telegramUrl(username, buildLeadMessage(draft(comment), SERVICES, uk)).length;
    const compact = telegramUrl(
      username,
      buildLeadMessage(draft(comment), SERVICES, uk, { format: 'compact' }),
    ).length;
    const fitted = fitLeadMessage(draft(comment), SERVICES, uk, {
      username,
      maxUrlLength: (full + compact) / 2,
    });
    expect(fitted.format).toBe('compact');
    expect(fitted.truncated).toBe(false);
    expect(fitted.text).toContain(comment.trim().replace(/\s+/g, ' '));
  });

  it('then trims the comment with "…" to fit the budget, as long as possible', () => {
    const comment = 'Потрібен бот із записом клієнтів, нагадуваннями й оплатою. 👩‍💻 '.repeat(30);
    const fitted = fitLeadMessage(draft(comment), SERVICES, uk, { username });
    expect(fitted.format).toBe('compact');
    expect(fitted.truncated).toBe(true);
    expect(fitted.text).toMatch(/Коментар: .+…$/);
    expect(telegramUrl(username, fitted.text).length).toBeLessThanOrEqual(2000);
    // The rest of the request is intact.
    expect(fitted.text).toContain('Рішення: Веброзробка + CRM');
    expect(fitted.text).toContain('Ім’я: Zoë Łukasiewicz');
    // No broken surrogate pairs.
    expect(fitted.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('as a last resort cuts the whole compact text', () => {
    const fitted = fitLeadMessage(draft('x'), SERVICES, pl, { username, maxUrlLength: 200 });
    expect(fitted.truncated).toBe(true);
    expect(fitted.text.endsWith('…')).toBe(true);
    expect(telegramUrl(username, fitted.text).length).toBeLessThanOrEqual(200);
  });
});
