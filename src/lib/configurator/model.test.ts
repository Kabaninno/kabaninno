import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { configuratorData } from '~/content/configurator';
import {
  GOAL_UNSURE,
  HAVE_NONE,
  OPTION_UNKNOWN,
  allServices,
  buildConfiguratorModel,
  findGoal,
  findService,
  getConfiguratorModel,
  typicalGoals,
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
        {
          id: 'hardware',
          services: [
            { slug: 'kiosks', pricePLN: [1000, 2000], timelineDays: [5, 10] },
            { slug: 'printers', pricePLN: [500, 900], timelineDays: [1, 3] },
          ],
        },
      ],
      configuratorData,
    );
    expect(extended.categories.at(-1)).toBe('hardware');
    expect(extended.services.hardware!.map((service) => service.id)).toEqual([
      'hardware/kiosks',
      'hardware/printers',
    ]);
    expect(findService(extended, 'hardware/kiosks')).toMatchObject({
      price: [1000, 2000],
      days: [5, 10],
    });
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

  it('carries the price and timeline of every service from the content (D156)', () => {
    expect(findService(model, 'web/landing-pages')).toMatchObject({
      price: [800, 1500],
      days: [2, 5],
    });
    expect(findService(model, 'telegram/mini-apps')).toMatchObject({
      price: [2500, 5000],
      days: [10, 21],
    });
    expect(model.currency).toBe('PLN');
  });

  it('marks 1–2 typical goals per industry, none for "other" (D155)', () => {
    expect(typicalGoals(model, 'beauty-health')).toEqual(['booking', 'more-clients']);
    expect(typicalGoals(model, 'other')).toEqual([]);
    expect(typicalGoals(model, null)).toEqual([]);
    for (const industry of model.industries.filter((id) => id !== 'other')) {
      const goals = typicalGoals(model, industry);
      expect(goals.length, industry).toBeGreaterThanOrEqual(1);
      expect(goals.length, industry).toBeLessThanOrEqual(2);
      for (const goal of goals) expect(findGoal(model, goal), goal).toBeDefined();
    }
    expect(() =>
      buildConfiguratorModel(getCategories(), {
        ...configuratorData,
        industryGoals: { shipyards: ['booking'] },
      }),
    ).toThrow('unknown industry "shipyards"');
    expect(() =>
      buildConfiguratorModel(getCategories(), {
        ...configuratorData,
        industryGoals: { food: ['ghost'] },
      }),
    ).toThrow('unknown goal "ghost"');
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
