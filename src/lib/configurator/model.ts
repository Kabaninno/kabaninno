import { z } from 'zod';
import { getCategories } from '~/content';
import { configuratorData, type ConfiguratorDataInput } from '~/content/configurator';
import { siteConfig } from '~/site.config';
import { serviceRef } from '../request-draft';

/**
 * The configurator's option model: which ids each step offers, derived from
 * the categories (content) and `content/configurator.ts`. Plain JSON (arrays
 * and records, no Sets), so it can be built on the server and passed to the
 * client wizard as a prop without shipping the content layer.
 */

/** Sentinel budget id for "not sure yet". */
export const BUDGET_NOT_SURE = 'not-sure';

export interface FeatureOption {
  /** `"<category>/<key>"`; for services the same string as a request ref (D66). */
  id: string;
  category: string;
  kind: 'service' | 'extra';
  /** Service slug or extra feature id (label key). */
  key: string;
}

export interface BudgetRange {
  id: string;
  min?: number;
  max?: number;
}

export interface ConfiguratorModel {
  /** Category ids, in content order (step 1). */
  types: string[];
  /** Feature options per category (step 2): services first, then extras. */
  features: Record<string, FeatureOption[]>;
  industries: string[];
  companySizes: string[];
  /** Budget ranges (without "not sure"; see `budgetIds`). */
  budgetRanges: BudgetRange[];
  currency: string;
  timelines: string[];
  limits: { nameMin: number; nameMax: number; commentMax: number };
}

const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use kebab-case ids');
const idListSchema = z
  .array(idSchema)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate id');

export const configuratorDataSchema = z.object({
  extraFeatures: z.record(z.string(), z.array(idSchema)),
  industries: idListSchema,
  companySizes: idListSchema,
  budgetRanges: z
    .array(
      z.object({
        id: idSchema.refine((id) => id !== BUDGET_NOT_SURE, 'Reserved id'),
        min: z.number().nonnegative().optional(),
        max: z.number().positive().optional(),
      }),
    )
    .min(1),
  timelines: idListSchema,
  contact: z.object({
    nameMin: z.number().int().positive(),
    nameMax: z.number().int().positive(),
    commentMax: z.number().int().positive(),
  }),
});

/** The part of a category the model needs (content `Category` fits). */
export interface CategoryLike {
  id: string;
  services: readonly { slug: string }[];
}

/**
 * Builds the model. Throws on inconsistent data (extras for an unknown
 * category, an extra repeating a service slug), so a content mistake fails
 * the build and the tests instead of reaching visitors.
 */
export function buildConfiguratorModel(
  categories: readonly CategoryLike[],
  input: ConfiguratorDataInput = configuratorData,
  currency: string = siteConfig.currency,
): ConfiguratorModel {
  const data = configuratorDataSchema.parse(input);
  const known = new Set(categories.map((category) => category.id));
  for (const id of Object.keys(data.extraFeatures)) {
    if (!known.has(id))
      throw new Error(`configurator: extra features for unknown category "${id}"`);
  }
  const features: Record<string, FeatureOption[]> = {};
  for (const category of categories) {
    const slugs = category.services.map((service) => service.slug);
    const extras = data.extraFeatures[category.id] ?? [];
    for (const extra of extras) {
      if (slugs.includes(extra)) {
        throw new Error(`configurator: extra "${extra}" repeats a service of "${category.id}"`);
      }
    }
    features[category.id] = [
      ...slugs.map((slug): FeatureOption => ({
        id: serviceRef(category.id, slug),
        category: category.id,
        kind: 'service',
        key: slug,
      })),
      ...[...new Set(extras)].map((extra): FeatureOption => ({
        id: serviceRef(category.id, extra),
        category: category.id,
        kind: 'extra',
        key: extra,
      })),
    ];
  }
  return {
    types: categories.map((category) => category.id),
    features,
    industries: data.industries,
    companySizes: data.companySizes,
    budgetRanges: data.budgetRanges,
    currency,
    timelines: data.timelines,
    limits: data.contact,
  };
}

let cached: ConfiguratorModel | null = null;

/** Server-side: the model of this build (content categories + configurator data). */
export function getConfiguratorModel(): ConfiguratorModel {
  cached ??= buildConfiguratorModel(getCategories());
  return cached;
}

/** Budget ids a draft may hold: the ranges plus "not sure". */
export function budgetIds(model: ConfiguratorModel): string[] {
  return [...model.budgetRanges.map((range) => range.id), BUDGET_NOT_SURE];
}

/** Every feature option of the given categories, in model order. */
export function featuresFor(model: ConfiguratorModel, types: readonly string[]): FeatureOption[] {
  return model.types
    .filter((type) => types.includes(type))
    .flatMap((type) => model.features[type] ?? []);
}

/** The feature option with this id, if any. */
export function findFeature(model: ConfiguratorModel, id: string): FeatureOption | undefined {
  const category = id.split('/')[0] ?? '';
  return model.features[category]?.find((feature) => feature.id === id);
}
