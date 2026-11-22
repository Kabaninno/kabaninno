import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { configuratorData } from '~/content/configurator';
import {
  BUDGET_NOT_SURE,
  GOAL_UNSURE,
  HAVE_NONE,
  OPTION_UNKNOWN,
  allBudgetIds,
  allServices,
  budgetIds,
  budgetRangeId,
  budgetRangesFor,
  buildConfiguratorModel,
  complexityLevel,
  findGoal,
  findService,
  getConfiguratorModel,
} from './model';

describe('configurator model', () => {
  const model = getConfiguratorModel();

  it('lists every category, with its services in content order', () => {
    expect(model.categories).toEqual(getCategories().map((category) => category.id));
    for (const category of getCategories()) {
      expect(model.services[category.id]!.map((service) => service.id)).toEqual(
        category.services.map((service) => `${category.id}/${service.slug}`),
      );
    }
    expect(allServices(model)).toHaveLength(20);
  });

  it('is plain JSON (built on the server, passed to the client)', () => {
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('every goal option recommends known services and every goal can answer "unknown"', () => {
    expect(model.goals.length).toBeGreaterThanOrEqual(5);
    for (const goal of model.goals) {
      expect(
        goal.options.some((option) => option.id === OPTION_UNKNOWN),
        goal.id,
      ).toBe(true);
      for (const option of goal.options) {
        expect(option.services.length, `${goal.id}/${option.id}`).toBeGreaterThan(0);
        for (const id of option.services) expect(findService(model, id), id).toBeDefined();
      }
    }
    expect(model.maxGoals).toBe(3);
    expect(model.maxRecommended).toBe(4);
    expect(model.have).toContain(HAVE_NONE);
    expect(model.goals.map((goal) => goal.id)).not.toContain(GOAL_UNSURE);
  });

  it('follows the table of the brief for the first goals', () => {
    const answer = (goal: string, option: string) =>
      findGoal(model, goal)!.options.find((item) => item.id === option)!.services;
    expect(answer('more-clients', 'google')).toEqual(['web/corporate-websites']);
    expect(answer('more-clients', 'social-ads')).toEqual(['web/landing-pages']);
    expect(answer('more-clients', 'messengers')).toEqual(['telegram/sales-orders']);
    expect(answer('online-orders', '20-200')).toEqual(['web/online-stores']);
    expect(answer('online-orders', 'over-200')).toEqual([
      'web/online-stores',
      'automation/api-integrations',
    ]);
    expect(answer('booking', 'phone')).toEqual([
      'telegram/booking',
      'automation/notifications-reminders',
    ]);
    expect(answer('client-order', 'spreadsheets')).toEqual([
      'crm/crm-implementation',
      'automation/api-integrations',
    ]);
    expect(answer('client-order', 'program-inconvenient')).toEqual(['crm/custom-crm']);
    expect(answer('less-routine', 'emails-requests')).toEqual(['ai/ai-document-processing']);
  });

  it('a new category needs no code change: it appears with its services', () => {
    const extended = buildConfiguratorModel(
      [
        ...getCategories(),
        { id: 'hardware', services: [{ slug: 'kiosks' }, { slug: 'printers' }] },
      ],
      {
        ...configuratorData,
        complexity: {
          ...configuratorData.complexity,
          'hardware/kiosks': 2,
          'hardware/printers': 1,
        },
      },
    );
    expect(extended.categories.at(-1)).toBe('hardware');
    expect(extended.services.hardware!.map((service) => service.id)).toEqual([
      'hardware/kiosks',
      'hardware/printers',
    ]);
  });

  it('rejects goals pointing at unknown services or without an "unknown" option', () => {
    const goal = configuratorData.goals[0]!;
    expect(() =>
      buildConfiguratorModel(getCategories(), {
        ...configuratorData,
        goals: [
          {
            ...goal,
            options: [...goal.options, { id: 'ghost', services: ['web/ghost'] }],
          },
        ],
      }),
    ).toThrow('unknown service "web/ghost"');
    expect(() =>
      buildConfiguratorModel(getCategories(), {
        ...configuratorData,
        goals: [
          {
            id: 'lonely',
            options: [
              { id: 'a', services: ['web/landing-pages'] },
              { id: 'b', services: ['web/landing-pages'] },
            ],
          },
        ],
      }),
    ).toThrow(/no "unknown" option/);
    expect(() =>
      buildConfiguratorModel(getCategories(), { ...configuratorData, have: ['website'] }),
    ).toThrow(/must include "none"/);
  });

  it('gives every service a complexity level 1–3', () => {
    for (const service of allServices(model)) {
      expect([1, 2, 3], service.id).toContain(model.complexity[service.id]);
    }
    expect(() =>
      buildConfiguratorModel(getCategories(), { ...configuratorData, complexity: {} }),
    ).toThrow(/no complexity level for/);
    expect(() =>
      buildConfiguratorModel(getCategories(), {
        ...configuratorData,
        complexity: { ...configuratorData.complexity, 'web/ghost': 1 },
      }),
    ).toThrow('unknown "web/ghost"');
  });

  it('derives range ids from the numbers', () => {
    expect(budgetRangeId({ max: 1500 })).toBe('up-to-1500');
    expect(budgetRangeId({ min: 1500, max: 3000 })).toBe('1500-3000');
    expect(budgetRangeId({ min: 3000 })).toBe('over-3000');
  });

  it('offers the ranges of the highest level among the selected services (D138)', () => {
    // Level 1: a landing page.
    const simple = ['web/landing-pages'];
    expect(complexityLevel(model, simple)).toBe(1);
    expect(budgetRangesFor(model, simple).map((range) => range.id)).toEqual([
      'up-to-1500',
      '1500-3000',
      'over-3000',
    ]);
    // Level 2: a store; level 3 wins as soon as a CRM is added.
    const store = ['web/landing-pages', 'web/online-stores'];
    expect(complexityLevel(model, store)).toBe(2);
    expect(budgetIds(model, store)).toEqual([
      'up-to-3000',
      '3000-6000',
      'over-6000',
      BUDGET_NOT_SURE,
    ]);
    const crm = ['web/online-stores', 'crm/custom-crm'];
    expect(complexityLevel(model, crm)).toBe(3);
    expect(budgetIds(model, crm)).toEqual([
      'up-to-5000',
      '5000-10000',
      'over-10000',
      BUDGET_NOT_SURE,
    ]);
  });

  it('a request without services is a consultation: level 2 (D149)', () => {
    expect(model.consultationLevel).toBe(2);
    expect(complexityLevel(model, [])).toBe(2);
    expect(budgetIds(model, [])).toEqual(budgetIds(model, ['web/online-stores']));
  });

  it('knows every range of every level (labels) and carries the currency', () => {
    expect(allBudgetIds(model).at(-1)).toBe(BUDGET_NOT_SURE);
    const distinct = new Set(
      Object.values(configuratorData.budgetLevels).flatMap((ranges) => ranges.map(budgetRangeId)),
    );
    expect(allBudgetIds(model)).toHaveLength(distinct.size + 1);
    expect(model.currency).toBe('PLN');
  });

  it('finds services and goals', () => {
    expect(findService(model, 'web/landing-pages')).toMatchObject({
      category: 'web',
      slug: 'landing-pages',
    });
    expect(findService(model, 'web/nope')).toBeUndefined();
    expect(findService(model, 'nope/seo')).toBeUndefined();
    expect(findGoal(model, 'booking')?.id).toBe('booking');
    expect(findGoal(model, GOAL_UNSURE)).toBeUndefined();
  });
});
