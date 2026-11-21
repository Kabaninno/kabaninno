import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { configuratorData } from '~/content/configurator';
import {
  BUDGET_NOT_SURE,
  allBudgetIds,
  budgetIds,
  budgetRangeId,
  budgetRangesFor,
  buildConfiguratorModel,
  complexityLevel,
  featuresFor,
  findFeature,
  getConfiguratorModel,
} from './model';

describe('configurator model', () => {
  const model = getConfiguratorModel();

  it('offers every category as a solution type, in content order', () => {
    expect(model.types).toEqual(getCategories().map((category) => category.id));
  });

  it('offers each category’s services first, then its extra features', () => {
    for (const category of getCategories()) {
      const options = model.features[category.id]!;
      const services = category.services.map((service) => `${category.id}/${service.slug}`);
      expect(options.slice(0, services.length).map((option) => option.id)).toEqual(services);
      expect(options.slice(0, services.length).every((option) => option.kind === 'service')).toBe(
        true,
      );
      const extras = options.slice(services.length);
      expect(extras.every((option) => option.kind === 'extra')).toBe(true);
    }
  });

  it('keeps extra features consistent with the categories', () => {
    const ids = new Set(getCategories().map((category) => category.id));
    for (const id of Object.keys(configuratorData.extraFeatures)) expect(ids.has(id)).toBe(true);
  });

  it('is plain JSON (built on the server, passed to the client)', () => {
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
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
    expect(extended.types.at(-1)).toBe('hardware');
    expect(extended.features.hardware!.map((option) => option.id)).toEqual([
      'hardware/kiosks',
      'hardware/printers',
    ]);
  });

  it('rejects extras for unknown categories and extras repeating a service', () => {
    expect(() =>
      buildConfiguratorModel([{ id: 'web', services: [] }], {
        ...configuratorData,
        extraFeatures: { nope: ['seo'] },
      }),
    ).toThrow(/unknown category "nope"/);
    expect(() =>
      buildConfiguratorModel([{ id: 'web', services: [{ slug: 'seo' }] }], {
        ...configuratorData,
        extraFeatures: { web: ['seo'] },
      }),
    ).toThrow(/repeats a service/);
  });

  it('gives every service and extra feature a complexity level 1–3', () => {
    for (const feature of Object.values(model.features).flat()) {
      expect([1, 2, 3], feature.id).toContain(model.complexity[feature.id]);
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

  it('offers the ranges of the highest level among the selected features (D138)', () => {
    const basis = (features: string[]) => ({
      types: [...new Set(features.map((id) => id.split('/')[0]!))],
      features,
    });
    // Level 1: a landing page and its SEO.
    const simple = basis(['web/landing-pages', 'web/seo']);
    expect(complexityLevel(model, simple)).toBe(1);
    expect(budgetRangesFor(model, simple).map((range) => range.id)).toEqual([
      'up-to-1500',
      '1500-3000',
      'over-3000',
    ]);
    // Level 2: a store; level 3 wins as soon as a CRM is added.
    const store = basis(['web/landing-pages', 'web/online-stores']);
    expect(complexityLevel(model, store)).toBe(2);
    expect(budgetIds(model, store)).toEqual([
      'up-to-3000',
      '3000-6000',
      'over-6000',
      BUDGET_NOT_SURE,
    ]);
    const crm = basis(['web/online-stores', 'crm/custom-crm']);
    expect(complexityLevel(model, crm)).toBe(3);
    expect(budgetIds(model, crm)).toEqual([
      'up-to-5000',
      '5000-10000',
      'over-10000',
      BUDGET_NOT_SURE,
    ]);
  });

  it('ignores features of categories that are not selected', () => {
    expect(
      complexityLevel(model, { types: ['web'], features: ['web/landing-pages', 'crm/custom-crm'] }),
    ).toBe(1);
  });

  it('knows every range of every level (labels) and carries the currency', () => {
    expect(allBudgetIds(model).at(-1)).toBe(BUDGET_NOT_SURE);
    const distinct = new Set(
      Object.values(configuratorData.budgetLevels).flatMap((ranges) => ranges.map(budgetRangeId)),
    );
    expect(allBudgetIds(model)).toHaveLength(distinct.size + 1);
    expect(model.currency).toBe('PLN');
  });

  it('finds features and lists them for selected types', () => {
    expect(findFeature(model, 'web/landing-pages')).toMatchObject({
      category: 'web',
      kind: 'service',
      key: 'landing-pages',
    });
    expect(findFeature(model, 'web/seo')).toMatchObject({ kind: 'extra' });
    expect(findFeature(model, 'web/nope')).toBeUndefined();
    expect(findFeature(model, 'nope/seo')).toBeUndefined();
    const selected = featuresFor(model, ['crm', 'web']);
    expect(selected[0]!.category).toBe('web');
    expect(new Set(selected.map((option) => option.category))).toEqual(new Set(['web', 'crm']));
  });
});
