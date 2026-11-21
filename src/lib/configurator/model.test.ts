import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { configuratorData } from '~/content/configurator';
import {
  BUDGET_NOT_SURE,
  budgetIds,
  buildConfiguratorModel,
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
    const extended = buildConfiguratorModel([
      ...getCategories(),
      { id: 'hardware', services: [{ slug: 'kiosks' }, { slug: 'printers' }] },
    ]);
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

  it('lists budget ids with "not sure" and carries the currency', () => {
    expect(budgetIds(model).at(-1)).toBe(BUDGET_NOT_SURE);
    expect(budgetIds(model)).toHaveLength(configuratorData.budgetRanges.length + 1);
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
