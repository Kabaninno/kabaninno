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
import {
  buildWizardLabels,
  errorText,
  fillTemplate,
  formatBudgetLabel,
  type Translate,
} from './labels';
import { emptyDraft } from './draft';
import { buildLeadMessage } from './message';
import {
  BUDGET_NOT_SURE,
  GOAL_UNSURE,
  OPTION_UNKNOWN,
  allBudgetIds,
  allServices,
  getConfiguratorModel,
} from './model';

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
  const services = messages.services as Record<
    string,
    Record<string, { title: string; benefit: string }>
  >;
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
    for (const id of model.timelines) expect(labels.timelines[id]).toBeTruthy();
    expect(Object.keys(labels.budgets)).toEqual(allBudgetIds(model));
    expect(labels.budgetReset).toBeTruthy();
    expect(labels.progress.guided).toHaveLength(CONFIGURATOR_STEPS.length);
    expect(labels.progress.manual).toHaveLength(CONFIGURATOR_STEPS.length - 1);
    // No leaked ICU arguments or message keys; the two client-side templates keep their {name}.
    const stripped = JSON.stringify({
      ...labels,
      solution: { ...labels.solution, fits: '', removeNamed: '' },
    });
    expect(stripped).not.toMatch(/\{\w+|configurator\.|lead\./);
    expect(labels.solution.fits).toContain('{combo}');
    expect(labels.solution.removeNamed).toContain('{service}');
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
    expect(labelsFor('uk').lead.title).toBe('Запит із сайту KABANINNO');
  });

  it('feeds the message generator with complete labels (pl, uk)', () => {
    const draft = {
      ...emptyDraft(),
      goals: ['booking', GOAL_UNSURE].slice(0, 1),
      answers: { booking: 'phone' },
      have: ['website', 'tracking'],
      industry: 'food',
      budget: BUDGET_NOT_SURE,
      timeline: 'asap',
      contact: { name: 'Łucja', comment: '' },
    };
    const services = ['telegram/booking', 'automation/notifications-reminders'];
    const pl = buildLeadMessage(draft, services, labelsFor('pl').lead);
    expect(pl).toContain('Zapytanie ze strony KABANINNO');
    expect(pl).toContain(plUi.configurator.goals.items.booking.name);
    expect(pl).toContain(plUi.configurator.goals.items.booking.options.phone);
    expect(pl).toContain(plUi.configurator.have.items.tracking);
    expect(pl).toContain(plUi.configurator.budget.notSure);
    const uk = buildLeadMessage(draft, services, labelsFor('uk').lead);
    expect(uk).toContain(ukUi.configurator.industries.food);
    expect(uk).toContain(ukUi.configurator.timelines.asap);
    expect(uk).toContain(ukUi.configurator.goals.items.booking.name);
    expect(`${pl}${uk}`).not.toContain('undefined');
    const consultation = buildLeadMessage(
      { ...draft, goals: [GOAL_UNSURE], answers: {} },
      [],
      labelsFor('pl').lead,
    );
    expect(consultation).toContain(plUi.lead.consultation);
    expect(consultation).toContain(plUi.lead.unsure);
  });
});

describe('fillTemplate', () => {
  it('fills known placeholders and leaves unknown ones visible', () => {
    expect(fillTemplate('Pasuje: {combo}', { combo: 'Web + CRM' })).toBe('Pasuje: Web + CRM');
    expect(fillTemplate('{a} i {b}', { a: 'x' })).toBe('x i {b}');
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
    const pl = labelsFor('pl').budgets['5000-10000']!;
    expect(pl.replace(/[  ]/g, ' ')).toBe('5 000–10 000 PLN netto');
    expect(labelsFor('en').budgets['up-to-1500']).toBe('up to PLN 1,500 net');
    expect(labelsFor('uk').budgets['over-6000']!.replace(/[  ]/g, ' ')).toBe(
      'понад 6 000 PLN нетто',
    );
  });
});

describe('errorText', () => {
  const errors = labelsFor('pl').errors;

  it('maps validation codes to field-specific messages', () => {
    expect(errorText('goals', 'required', errors)).toBe(errors.requiredMulti);
    expect(errorText('answers.booking', 'required', errors)).toBe(errors.requiredOne);
    expect(errorText('budget', 'required', errors)).toBe(errors.requiredOne);
    expect(errorText('contact.name', 'required', errors)).toBe(errors.requiredText);
    expect(errorText('contact.name', 'tooShort', errors)).toBe(errors.nameTooShort);
    expect(errorText('contact.name', 'tooLong', errors)).toBe(errors.nameTooLong);
    expect(errorText('contact.comment', 'tooLong', errors)).toBe(errors.commentTooLong);
    expect(errorText('industry', 'tooLong', errors)).toBe(errors.industryTooLong);
    expect(errorText('budget', 'unknown', errors)).toBe(errors.unknown);
  });
});
