import { describe, expect, it } from 'vitest';
import type { ConfiguratorDraft } from './draft';
import { buildLeadMessage, fitLeadMessage, type LeadLabels } from './message';
import { telegramUrl } from './telegram';

/** Label fixtures as phase B will resolve them from ui.json / content texts. */
const pl: LeadLabels = {
  title: 'Zapytanie ze strony KABANINNO',
  types: 'Rodzaj rozwiązania',
  features: 'Funkcje',
  business: 'Firma',
  website: 'Strona WWW',
  crm: 'CRM',
  budget: 'Budżet',
  timeline: 'Termin',
  name: 'Imię',
  comment: 'Komentarz',
  yes: 'tak',
  no: 'nie',
  categories: { web: 'Strony i aplikacje', crm: 'CRM' },
  featureNames: {
    'web/landing-pages': 'Landing page',
    'web/seo': 'Pozycjonowanie (SEO)',
    'crm/custom-crm': 'CRM szyty na miarę',
  },
  industries: { retail: 'Handel' },
  sizes: { '2-10': '2–10 osób' },
  budgets: { '15k-40k': '15\u00A0000–40\u00A0000 PLN', 'not-sure': 'Jeszcze nie wiem' },
  timelines: { '1-3-months': '1–3 miesiące' },
};

const en: LeadLabels = {
  ...pl,
  title: 'Request from the KABANINNO website',
  types: 'Solution type',
  features: 'Features',
  business: 'Business',
  website: 'Website',
  budget: 'Budget',
  timeline: 'Timeline',
  name: 'Name',
  comment: 'Comment',
  yes: 'yes',
  no: 'no',
  categories: { web: 'Web Development', crm: 'CRM' },
  featureNames: {
    'web/landing-pages': 'Landing pages',
    'web/seo': 'SEO',
    'crm/custom-crm': 'Custom CRM',
  },
  industries: { retail: 'Retail' },
  sizes: { '2-10': '2–10 people' },
  budgets: { '15k-40k': 'PLN 15,000–40,000', 'not-sure': 'Not sure yet' },
  timelines: { '1-3-months': '1–3 months' },
};

const uk: LeadLabels = {
  ...pl,
  title: 'Запит із сайту KABANINNO',
  types: 'Тип рішення',
  features: 'Функції',
  business: 'Бізнес',
  website: 'Сайт',
  budget: 'Бюджет',
  timeline: 'Терміни',
  name: 'Ім’я',
  comment: 'Коментар',
  yes: 'так',
  no: 'ні',
  categories: { web: 'Веброзробка', crm: 'CRM' },
  featureNames: {
    'web/landing-pages': 'Лендинги',
    'web/seo': 'SEO-оптимізація',
    'crm/custom-crm': 'Кастомна CRM',
  },
  industries: { retail: 'Торгівля' },
  sizes: { '2-10': '2–10 осіб' },
  budgets: { '15k-40k': '15\u202F000–40\u202F000 PLN', 'not-sure': 'Ще не знаю' },
  timelines: { '1-3-months': '1–3 місяці' },
};

function draft(comment = ''): ConfiguratorDraft {
  return {
    types: ['web', 'crm'],
    features: ['web/landing-pages', 'web/seo', 'crm/custom-crm'],
    business: { industry: 'retail', size: '2-10', hasWebsite: 'yes', hasCrm: 'no' },
    budget: '15k-40k',
    timeline: '1-3-months',
    contact: { name: '  Zoë  Łukasiewicz ', comment },
  };
}

describe('buildLeadMessage', () => {
  it('pl, full format: readable blocks, Polish diacritics intact', () => {
    expect(buildLeadMessage(draft('Potrzebny sklep z integracją.\nPilne.'), pl)).toBe(
      [
        'Zapytanie ze strony KABANINNO',
        '',
        'Rodzaj rozwiązania: Strony i aplikacje, CRM',
        'Funkcje:',
        '• Landing page',
        '• Pozycjonowanie (SEO)',
        '• CRM szyty na miarę',
        'Firma: Handel, 2–10 osób',
        'Strona WWW: tak · CRM: nie',
        'Budżet: 15 000–40 000 PLN',
        'Termin: 1–3 miesiące',
        'Imię: Zoë Łukasiewicz',
        '',
        'Komentarz:',
        'Potrzebny sklep z integracją.\nPilne.',
      ].join('\n'),
    );
  });

  it('en and uk use only the given labels (Cyrillic intact)', () => {
    const english = buildLeadMessage(draft(), en);
    expect(english).toContain('Solution type: Web Development, CRM');
    expect(english).toContain('Website: yes · CRM: no');
    expect(english).not.toMatch(/[ąęłńóśźżА-я]/);

    const ukrainian = buildLeadMessage(draft('Потрібна інтеграція з Telegram, ґанок і їжак.'), uk);
    expect(ukrainian.split('\n')[0]).toBe('Запит із сайту KABANINNO');
    expect(ukrainian).toContain('Тип рішення: Веброзробка, CRM');
    expect(ukrainian).toContain('Ім’я: Zoë Łukasiewicz');
    expect(ukrainian).toContain('Потрібна інтеграція з Telegram, ґанок і їжак.');
  });

  it('turns every no-break space into a plain space (D35)', () => {
    for (const labels of [pl, uk]) {
      expect(buildLeadMessage(draft('a\u00A0b'), labels)).not.toMatch(/[\u00A0\u202F\u2007]/);
    }
    expect(buildLeadMessage(draft(), uk)).toContain('Бюджет: 15 000–40 000 PLN');
  });

  it('compact format: one line per section, comment collapsed', () => {
    expect(buildLeadMessage(draft('Pilne.\n\nBardzo.'), pl, { format: 'compact' })).toBe(
      [
        'Zapytanie ze strony KABANINNO',
        'Rodzaj rozwiązania: Strony i aplikacje, CRM',
        'Funkcje: Landing page, Pozycjonowanie (SEO), CRM szyty na miarę',
        'Firma: Handel, 2–10 osób; Strona WWW: tak; CRM: nie',
        'Budżet: 15 000–40 000 PLN · Termin: 1–3 miesiące',
        'Imię: Zoë Łukasiewicz',
        'Komentarz: Pilne. Bardzo.',
      ].join('\n'),
    );
  });

  it('skips unanswered sections and never prints "undefined" for unknown ids', () => {
    const partial: ConfiguratorDraft = {
      types: ['ai'],
      features: [],
      business: { industry: null, size: null, hasWebsite: null, hasCrm: 'yes' },
      budget: 'not-sure',
      timeline: null,
      contact: { name: '', comment: '' },
    };
    const text = buildLeadMessage(partial, pl);
    expect(text).toBe(
      [
        'Zapytanie ze strony KABANINNO',
        '',
        'Rodzaj rozwiązania: ai',
        'CRM: tak',
        'Budżet: Jeszcze nie wiem',
      ].join('\n'),
    );
    expect(text).not.toContain('undefined');
  });
});

describe('fitLeadMessage', () => {
  const username = 'kabaninno_studio';

  it('keeps the full format when it fits', () => {
    const fitted = fitLeadMessage(draft('Krótki komentarz.'), pl, { username });
    expect(fitted).toEqual({
      text: buildLeadMessage(draft('Krótki komentarz.'), pl),
      format: 'full',
      truncated: false,
    });
  });

  it('switches to the compact format before touching the comment', () => {
    const comment = 'Потрібна інтеграція з CRM. '.repeat(8);
    const full = telegramUrl(username, buildLeadMessage(draft(comment), uk)).length;
    const compact = telegramUrl(
      username,
      buildLeadMessage(draft(comment), uk, { format: 'compact' }),
    ).length;
    const fitted = fitLeadMessage(draft(comment), uk, {
      username,
      maxUrlLength: (full + compact) / 2,
    });
    expect(fitted.format).toBe('compact');
    expect(fitted.truncated).toBe(false);
    expect(fitted.text).toContain(comment.trim().replace(/\s+/g, ' '));
  });

  it('then trims the comment with "…" to fit the budget, as long as possible', () => {
    const comment = 'Потрібен бот із записом клієнтів, нагадуваннями й оплатою. 👩‍💻 '.repeat(30);
    const fitted = fitLeadMessage(draft(comment), uk, { username });
    expect(fitted.format).toBe('compact');
    expect(fitted.truncated).toBe(true);
    expect(fitted.text).toMatch(/Коментар: .+…$/);
    expect(telegramUrl(username, fitted.text).length).toBeLessThanOrEqual(2000);
    // The rest of the request is intact.
    expect(fitted.text).toContain('Тип рішення: Веброзробка, CRM');
    expect(fitted.text).toContain('Ім’я: Zoë Łukasiewicz');
    // No broken surrogate pairs.
    expect(fitted.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('as a last resort cuts the whole compact text', () => {
    const fitted = fitLeadMessage(draft('x'), pl, { username, maxUrlLength: 200 });
    expect(fitted.truncated).toBe(true);
    expect(fitted.text.endsWith('…')).toBe(true);
    expect(telegramUrl(username, fitted.text).length).toBeLessThanOrEqual(200);
  });
});
