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
  /** Derived from the numbers: `up-to-1500`, `1500-3000`, `over-3000` (D138). */
  id: string;
  min?: number;
  max?: number;
}

/** Complexity levels of features, and the budget ranges offered per level. */
export const COMPLEXITY_LEVELS = [1, 2, 3] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

/** The id of a budget range, from its numbers (kebab-case, stable when labels change). */
export function budgetRangeId(range: { min?: number; max?: number }): string {
  if (range.min !== undefined && range.max !== undefined) return `${range.min}-${range.max}`;
  if (range.max !== undefined) return `up-to-${range.max}`;
  return `over-${range.min ?? 0}`;
}

export interface ConfiguratorModel {
  /** Category ids, in content order (step 1). */
  types: string[];
  /** Feature options per category (step 2): services first, then extras. */
  features: Record<string, FeatureOption[]>;
  industries: string[];
  companySizes: string[];
  /** Every distinct budget range (labels; without "not sure"). */
  budgetRanges: BudgetRange[];
  /** The ranges offered per complexity level, lowest first (step 4, see `budgetRangesFor`). */
  budgetLevels: Record<ComplexityLevel, BudgetRange[]>;
  /** Complexity level of every feature, by id `"<category>/<key>"`. */
  complexity: Record<string, ComplexityLevel>;
  currency: string;
  timelines: string[];
  limits: { nameMin: number; nameMax: number; commentMax: number };
}

const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use kebab-case ids');
const levelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const rangeSchema = z
  .object({
    min: z.number().nonnegative().optional(),
    max: z.number().positive().optional(),
  })
  .refine((range) => range.min !== undefined || range.max !== undefined, 'Empty range')
  .refine(
    (range) => range.min === undefined || range.max === undefined || range.min < range.max,
    'min must be below max',
  );
const idListSchema = z
  .array(idSchema)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate id');

export const configuratorDataSchema = z.object({
  extraFeatures: z.record(z.string(), z.array(idSchema)),
  industries: idListSchema,
  companySizes: idListSchema,
  complexity: z.record(z.string(), levelSchema),
  budgetLevels: z.object({
    1: z.array(rangeSchema).min(1),
    2: z.array(rangeSchema).min(1),
    3: z.array(rangeSchema).min(1),
  }),
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
 * category, an extra repeating a service slug, a feature without a complexity
 * level or a level for an unknown feature), so a content mistake fails the
 * build and the tests instead of reaching visitors.
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
  const featureIds = new Set(
    Object.values(features)
      .flat()
      .map((feature) => feature.id),
  );
  for (const id of featureIds) {
    if (!(id in data.complexity)) throw new Error(`configurator: no complexity level for "${id}"`);
  }
  for (const id of Object.keys(data.complexity)) {
    if (!featureIds.has(id)) throw new Error(`configurator: complexity level for unknown "${id}"`);
  }
  const withIds = (ranges: readonly { min?: number; max?: number }[]): BudgetRange[] =>
    ranges.map((range) => ({ id: budgetRangeId(range), ...range }));
  const budgetLevels = {
    1: withIds(data.budgetLevels[1]),
    2: withIds(data.budgetLevels[2]),
    3: withIds(data.budgetLevels[3]),
  };
  const budgetRanges = [
    ...new Map(
      COMPLEXITY_LEVELS.flatMap((level) => budgetLevels[level]).map((range) => [range.id, range]),
    ).values(),
  ];
  return {
    types: categories.map((category) => category.id),
    features,
    industries: data.industries,
    companySizes: data.companySizes,
    budgetRanges,
    budgetLevels,
    complexity: data.complexity,
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

/** The part of a draft that decides the budget ranges. */
export interface BudgetBasis {
  types: readonly string[];
  features: readonly string[];
}

/**
 * Complexity level of a request: the highest level among the selected
 * features of the selected categories (D138). Level 1 when nothing is
 * selected (that step is not reachable then).
 */
export function complexityLevel(model: ConfiguratorModel, basis: BudgetBasis): ComplexityLevel {
  let level: ComplexityLevel = 1;
  for (const id of basis.features) {
    if (!basis.types.includes(id.split('/')[0] ?? '')) continue;
    const own = model.complexity[id];
    if (own !== undefined && own > level) level = own;
  }
  return level;
}

/** The budget ranges offered for this selection (without "not sure"). */
export function budgetRangesFor(model: ConfiguratorModel, basis: BudgetBasis): BudgetRange[] {
  return model.budgetLevels[complexityLevel(model, basis)];
}

/** Budget ids a draft may hold for this selection: its level's ranges plus "not sure". */
export function budgetIds(model: ConfiguratorModel, basis: BudgetBasis): string[] {
  return [...budgetRangesFor(model, basis).map((range) => range.id), BUDGET_NOT_SURE];
}

/** Every budget id the model knows (any level) plus "not sure"; for labels. */
export function allBudgetIds(model: ConfiguratorModel): string[] {
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
