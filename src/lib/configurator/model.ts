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
 * The configurator's option model: which industries, goals and services each
 * step offers, with the services' indicative prices and timelines, derived
 * from the categories (content) and `content/configurator.ts`.
 * Plain JSON (arrays and records, no Sets), so it can be built on the server
 * and passed to the client wizard as a prop without shipping the content layer.
 */

export { OPTION_UNKNOWN };

/** Sentinel goal id for "I don't know yet, advise me": exclusive with the real goals. */
export const GOAL_UNSURE = 'unsure';

/** The exclusive "nothing of these" answer of "What do you already have?". */
export const HAVE_NONE = 'none';

export interface ServiceOption {
  /** `"<category>/<slug>"`; the same string as a request ref (D66). */
  id: string;
  category: string;
  slug: string;
  /** Indicative price range in PLN, `[min, max]` (content `pricePLN`). */
  price: [number, number];
  /** Indicative timeline in days, `[min, max]` (content `timelineDays`). */
  days: [number, number];
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
  /** Goals typical for an industry (1–2), marked on the goals step; none for `other`. */
  industryGoals: Record<string, string[]>;
  /** The currency of the estimate (`siteConfig.currency`). */
  currency: string;
  limits: { nameMin: number; nameMax: number; commentMax: number };
}

const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use kebab-case ids');
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
  industries: idListSchema,
  industryGoals: z.record(idSchema, z.array(idSchema).min(1).max(2)),
  contact: z.object({
    nameMin: z.number().int().positive(),
    nameMax: z.number().int().positive(),
    commentMax: z.number().int().positive(),
  }),
});

/** The part of a category the model needs (content `Category` fits). */
export interface CategoryLike {
  id: string;
  services: readonly {
    slug: string;
    pricePLN: readonly [number, number];
    timelineDays: readonly [number, number];
  }[];
}

/**
 * Builds the model. Throws on inconsistent data (a goal option pointing at an
 * unknown service, a goal without its "unknown" option, typical goals of an
 * unknown industry or pointing at an unknown goal), so a content mistake
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
      price: [service.pricePLN[0], service.pricePLN[1]],
      days: [service.timelineDays[0], service.timelineDays[1]],
    }));
  }
  const serviceIds = new Set(
    Object.values(services)
      .flat()
      .map((service) => service.id),
  );
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
  const goalIds = new Set(data.goals.map((goal) => goal.id));
  for (const [industry, goals] of Object.entries(data.industryGoals)) {
    if (!data.industries.includes(industry)) {
      throw new Error(`configurator: typical goals for unknown industry "${industry}"`);
    }
    for (const goal of goals) {
      if (!goalIds.has(goal)) {
        throw new Error(`configurator: industry "${industry}" points at unknown goal "${goal}"`);
      }
    }
  }
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
    industryGoals: Object.fromEntries(
      Object.entries(data.industryGoals).map(([industry, goals]) => [industry, [...goals]]),
    ),
    currency,
    limits: data.contact,
  };
}

let cached: ConfiguratorModel | null = null;

/** Server-side: the model of this build (content categories + configurator data). */
export function getConfiguratorModel(): ConfiguratorModel {
  cached ??= buildConfiguratorModel(getCategories());
  return cached;
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

/** The goals typical for this industry (none for `other` or no industry). */
export function typicalGoals(model: ConfiguratorModel, industry: string | null): string[] {
  return industry ? (model.industryGoals[industry] ?? []) : [];
}

/** The goal with this id, if any. */
export function findGoal(model: ConfiguratorModel, id: string): GoalModel | undefined {
  return model.goals.find((goal) => goal.id === id);
}
