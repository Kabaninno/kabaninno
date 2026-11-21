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
import { buildWizardLabels, errorText, formatBudgetLabel, type Translate } from './labels';
import { buildLeadMessage } from './message';
import { BUDGET_NOT_SURE, getConfiguratorModel } from './model';

const model = getConfiguratorModel();
const dictionaries = {
  pl: { ...plUi, ...plContent },
  en: { ...enUi, ...enContent },
  uk: { ...ukUi, ...ukContent },
} as const;

function labelsFor(locale: keyof typeof dictionaries) {
  const messages = dictionaries[locale];
  const translator = (namespace: 'configurator' | 'lead') =>
    createTranslator({ locale, messages, namespace }) as unknown as Translate;
  const services = messages.services as Record<string, Record<string, { title: string }>>;
  return buildWizardLabels({
    locale,
    model,
    t: translator('configurator'),
    tLead: translator('lead'),
    studio: 'KABANINNO',
    category: (id) => ({
      name: (messages.categories as Record<string, { name: string }>)[id]!.name,
      color: getCategory(id)!.dna.color,
    }),
    serviceTitle: (category, slug) => services[category]![slug]!.title,
  });
}

describe('buildWizardLabels', () => {
  it.each(['pl', 'en', 'uk'] as const)('labels every option of the model (%s)', (locale) => {
    const labels = labelsFor(locale);
    for (const step of CONFIGURATOR_STEPS) {
      expect(labels.steps[step]).toBeTruthy();
      expect(labels.hints[step]).toBeTruthy();
    }
    for (const type of model.types) expect(labels.categories[type]?.name).toBeTruthy();
    for (const feature of Object.values(model.features).flat()) {
      expect(labels.features[feature.id], feature.id).toBeTruthy();
    }
    for (const id of model.industries) expect(labels.industries[id]).toBeTruthy();
    for (const id of model.companySizes) expect(labels.sizes[id]).toBeTruthy();
    for (const id of model.timelines) expect(labels.timelines[id]).toBeTruthy();
    expect(Object.keys(labels.budgets)).toEqual([
      ...model.budgetRanges.map((range) => range.id),
      BUDGET_NOT_SURE,
    ]);
    expect(labels.progress).toHaveLength(CONFIGURATOR_STEPS.length);
    const strings = JSON.stringify(labels);
    expect(strings).not.toMatch(/\{\w+|configurator\.|lead\./);
  });

  it('takes service names from content and extras from the dictionary', () => {
    const labels = labelsFor('pl');
    expect(labels.features['web/landing-pages']).toBe(
      (plContent.services as Record<string, Record<string, { title: string }>>).web![
        'landing-pages'
      ]!.title,
    );
    expect(labels.features['web/seo']).toBe(plUi.configurator.extras.seo);
  });

  it('formats progress, limits and the message title per locale', () => {
    expect(labelsFor('pl').progress[2]).toBe('Krok 3 z 7');
    expect(labelsFor('uk').progress[6]).toBe('Крок 7 з 7');
    expect(labelsFor('pl').errors.nameTooShort).toBe('Wpisz co najmniej 2 znaki.');
    expect(labelsFor('pl').errors.commentTooLong).toBe('Maksymalnie 1000 znaków.');
    expect(labelsFor('en').errors.nameTooLong).toBe('Up to 80 characters.');
    expect(labelsFor('uk').lead.title).toBe('Запит із сайту KABANINNO');
  });

  it('feeds the message generator with complete labels (pl, uk)', () => {
    const draft = {
      types: ['web', 'telegram'],
      features: ['web/online-stores', 'telegram/online-payments'],
      business: { industry: 'food', size: 'solo', hasWebsite: 'no', hasCrm: 'no' } as const,
      budget: BUDGET_NOT_SURE,
      timeline: 'asap',
      contact: { name: 'Łucja', comment: '' },
    };
    const pl = buildLeadMessage(draft, labelsFor('pl').lead);
    expect(pl).toContain('Zapytanie ze strony KABANINNO');
    expect(pl).toContain(plUi.configurator.extras['online-payments']);
    expect(pl).toContain(plUi.configurator.budget.notSure);
    const uk = buildLeadMessage(draft, labelsFor('uk').lead);
    expect(uk).toContain(ukUi.configurator.industries.food);
    expect(uk).toContain(ukUi.configurator.timelines.asap);
    expect(`${pl}${uk}`).not.toContain('undefined');
  });
});

describe('formatBudgetLabel', () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}:${JSON.stringify(values)}`;

  it('formats amounts with the locale’s grouping and picks the template', () => {
    expect(formatBudgetLabel({ id: 'a', min: 15000, max: 40000 }, 'en', 'PLN', t)).toBe(
      'budget.range:{"min":"15,000","max":"40,000","currency":"PLN"}',
    );
    expect(formatBudgetLabel({ id: 'b', max: 5000 }, 'en', 'PLN', t)).toBe(
      'budget.upTo:{"max":"5,000","currency":"PLN"}',
    );
    expect(formatBudgetLabel({ id: 'c', min: 40000 }, 'en', 'PLN', t)).toBe(
      'budget.from:{"min":"40,000","currency":"PLN"}',
    );
  });

  it('produces real labels per locale (no-break spaces are normalised later, D35)', () => {
    const pl = labelsFor('pl').budgets['15k-40k']!;
    expect(pl.replace(/[\u00A0\u202F]/g, ' ')).toBe('15 000–40 000 PLN');
    expect(labelsFor('en').budgets['up-to-5k']).toBe('up to PLN 5,000');
  });
});

describe('errorText', () => {
  const errors = labelsFor('pl').errors;

  it('maps validation codes to field-specific messages', () => {
    expect(errorText('types', 'required', errors)).toBe(errors.requiredMulti);
    expect(errorText('features', 'required', errors)).toBe(errors.requiredMulti);
    expect(errorText('business.size', 'required', errors)).toBe(errors.requiredOne);
    expect(errorText('contact.name', 'required', errors)).toBe(errors.requiredText);
    expect(errorText('contact.name', 'tooShort', errors)).toBe(errors.nameTooShort);
    expect(errorText('contact.name', 'tooLong', errors)).toBe(errors.nameTooLong);
    expect(errorText('contact.comment', 'tooLong', errors)).toBe(errors.commentTooLong);
    expect(errorText('budget', 'unknown', errors)).toBe(errors.unknown);
  });
});
