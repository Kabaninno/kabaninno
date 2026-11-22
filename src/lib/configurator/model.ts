import { z } from 'zod';
import { getCategories } from '~/content';
import {
  OPTION_UNKNOWN,
  configuratorData,
  type ConfiguratorDataInput,
} from '~/content/configurator';
import { siteConfig } from '~/site.config';
import { serviceRef } from '../request-draft';

/**
 * The configurator's option model: which goals, services and ranges each step
 * offers, derived from the categories (content) and `content/configurator.ts`.
 * Plain JSON (arrays and records, no Sets), so it can be built on the server
 * and passed to the client wizard as a prop without shipping the content layer.
 */

export { OPTION_UNKNOWN };

/** Sentinel budget id for "not sure yet". */
export const BUDGET_NOT_SURE = 'not-sure';

/** Sentinel goal id for "I don't know yet, advise me": exclusive with the real goals. */
export const GOAL_UNSURE = 'unsure';

/** The exclusive "nothing of these" answer of "What do you already have?". */
export const HAVE_NONE = 'none';

export interface ServiceOption {
  /** `"<category>/<slug>"`; the same string as a request ref (D66). */
  id: string;
  category: string;
  slug: string;
}

export interface GoalOptionModel {
  id: string;
  /** Recommended service ids, most important first. */
  services: string[];
}

export interface GoalModel {
  id: string;
  options: GoalOptionModel[];
}

export interface BudgetRange {
  /** Derived from the numbers: `up-to-1500`, `1500-3000`, `over-3000` (D138). */
  id: string;
  min?: number;
  max?: number;
}

/** Complexity levels of services, and the budget ranges offered per level. */
export const COMPLEXITY_LEVELS = [1, 2, 3] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

/** The id of a budget range, from its numbers (kebab-case, stable when labels change). */
export function budgetRangeId(range: { min?: number; max?: number }): string {
  if (range.min !== undefined && range.max !== undefined) return `${range.min}-${range.max}`;
  if (range.max !== undefined) return `up-to-${range.max}`;
  return `over-${range.min ?? 0}`;
}

export interface ConfiguratorModel {
  /** Category ids, in content order. */
  categories: string[];
  /** Services per category, in content order. */
  services: Record<string, ServiceOption[]>;
  /** The goals of step 1, with their question's options (step 2). */
  goals: GoalModel[];
  /** Ids of "What do you already have?" (`HAVE_NONE` is exclusive). */
  have: string[];
  maxGoals: number;
  maxRecommended: number;
  industries: string[];
  /** Every distinct budget range (labels; without "not sure"). */
  budgetRanges: BudgetRange[];
  /** The ranges offered per complexity level, lowest first (see `budgetRangesFor`). */
  budgetLevels: Record<ComplexityLevel, BudgetRange[]>;
  /** Complexity level of every service, by id `"<category>/<slug>"`. */
  complexity: Record<string, ComplexityLevel>;
  /** The level of a request without services (a consultation). */
  consultationLevel: ComplexityLevel;
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

const goalSchema = z.object({
  id: idSchema,
  options: z
    .array(z.object({ id: idSchema, services: z.array(z.string()).min(1) }))
    .min(2)
    .refine((options) => new Set(options.map((option) => option.id)).size === options.length, {
      message: 'Duplicate option id',
    }),
});

export const configuratorDataSchema = z.object({
  maxGoals: z.number().int().positive(),
  maxRecommended: z.number().int().positive(),
  goals: z
    .array(goalSchema)
    .min(1)
    .refine((goals) => new Set(goals.map((goal) => goal.id)).size === goals.length, {
      message: 'Duplicate goal id',
    }),
  have: idListSchema,
  complexity: z.record(z.string(), levelSchema),
  consultationLevel: levelSchema,
  budgetLevels: z.object({
    1: z.array(rangeSchema).min(1),
    2: z.array(rangeSchema).min(1),
    3: z.array(rangeSchema).min(1),
  }),
  industries: idListSchema,
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
 * Builds the model. Throws on inconsistent data (a goal option pointing at an
 * unknown service, a goal without its "unknown" option, a service without a
 * complexity level or a level for an unknown service), so a content mistake
 * fails the build and the tests instead of reaching visitors.
 */
export function buildConfiguratorModel(
  categories: readonly CategoryLike[],
  input: ConfiguratorDataInput = configuratorData,
  currency: string = siteConfig.currency,
): ConfiguratorModel {
  const data = configuratorDataSchema.parse(input);
  const services: Record<string, ServiceOption[]> = {};
  for (const category of categories) {
    services[category.id] = category.services.map((service): ServiceOption => ({
      id: serviceRef(category.id, service.slug),
      category: category.id,
      slug: service.slug,
    }));
  }
  const serviceIds = new Set(
    Object.values(services)
      .flat()
      .map((service) => service.id),
  );
  for (const id of serviceIds) {
    if (!(id in data.complexity)) throw new Error(`configurator: no complexity level for "${id}"`);
  }
  for (const id of Object.keys(data.complexity)) {
    if (!serviceIds.has(id)) throw new Error(`configurator: complexity level for unknown "${id}"`);
  }
  for (const goal of data.goals) {
    if (!goal.options.some((option) => option.id === OPTION_UNKNOWN)) {
      throw new Error(`configurator: goal "${goal.id}" has no "${OPTION_UNKNOWN}" option`);
    }
    for (const option of goal.options) {
      for (const id of option.services) {
        if (!serviceIds.has(id)) {
          throw new Error(
            `configurator: goal "${goal.id}" option "${option.id}" points at unknown service "${id}"`,
          );
        }
      }
    }
  }
  if (!data.have.includes(HAVE_NONE)) {
    throw new Error(`configurator: "have" must include "${HAVE_NONE}"`);
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
    categories: categories.map((category) => category.id),
    services,
    goals: data.goals.map((goal) => ({
      id: goal.id,
      options: goal.options.map((option) => ({ id: option.id, services: [...option.services] })),
    })),
    have: data.have,
    maxGoals: data.maxGoals,
    maxRecommended: data.maxRecommended,
    industries: data.industries,
    budgetRanges,
    budgetLevels,
    complexity: data.complexity,
    consultationLevel: data.consultationLevel,
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

/**
 * Complexity level of a request: the highest level among the selected
 * services (D138); `consultationLevel` when none is selected (a consultation).
 */
export function complexityLevel(
  model: ConfiguratorModel,
  services: readonly string[],
): ComplexityLevel {
  let level: ComplexityLevel | null = null;
  for (const id of services) {
    const own = model.complexity[id];
    if (own !== undefined && (level === null || own > level)) level = own;
  }
  return level ?? model.consultationLevel;
}

/** The budget ranges offered for these services (without "not sure"). */
export function budgetRangesFor(
  model: ConfiguratorModel,
  services: readonly string[],
): BudgetRange[] {
  return model.budgetLevels[complexityLevel(model, services)];
}

/** Budget ids a draft may hold for these services: their level's ranges plus "not sure". */
export function budgetIds(model: ConfiguratorModel, services: readonly string[]): string[] {
  return [...budgetRangesFor(model, services).map((range) => range.id), BUDGET_NOT_SURE];
}

/** Every budget id the model knows (any level) plus "not sure"; for labels. */
export function allBudgetIds(model: ConfiguratorModel): string[] {
  return [...model.budgetRanges.map((range) => range.id), BUDGET_NOT_SURE];
}

/** Every service of the model, in content order. */
export function allServices(model: ConfiguratorModel): ServiceOption[] {
  return model.categories.flatMap((category) => model.services[category] ?? []);
}

/** The service with this id, if any. */
export function findService(model: ConfiguratorModel, id: string): ServiceOption | undefined {
  const category = id.split('/')[0] ?? '';
  return model.services[category]?.find((service) => service.id === id);
}

/** The goal with this id, if any. */
export function findGoal(model: ConfiguratorModel, id: string): GoalModel | undefined {
  return model.goals.find((goal) => goal.id === id);
}
