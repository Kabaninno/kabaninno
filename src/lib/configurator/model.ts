import { z } from 'zod';
import { getCategories } from '~/content';
import {
  OPTION_UNKNOWN,
  TELEGRAM_CATEGORY,
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

export { OPTION_UNKNOWN, TELEGRAM_CATEGORY };

/** A service of the Telegram bots category (recommended in `telegramLocales` only, D160). */
export function isTelegramService(id: string): boolean {
  return id.split('/')[0] === TELEGRAM_CATEGORY;
}

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
  /**
   * Recommended service ids, most important first, already for the model's
   * locale: without Telegram outside `telegramLocales` (D160).
   */
  services: string[];
}

export interface GoalModel {
  id: string;
  options: GoalOptionModel[];
}

export interface ConfiguratorModel {
  /** Category ids, in content order. */
  categories: string[];
  /** The goals may recommend Telegram services in this locale (D160). */
  telegramRecommended: boolean;
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
    .array(
      z.object({
        id: idSchema,
        services: z.array(z.string()).min(1),
        servicesNoTelegram: z.array(z.string()).min(1).optional(),
      }),
    )
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
  telegramLocales: z.array(z.string()),
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
 * unknown industry or pointing at an unknown goal, a Telegram answer without
 * its no-Telegram list), so a content mistake fails the build and the tests
 * instead of reaching visitors.
 *
 * `locale`: the interface locale. Outside `telegramLocales` every answer
 * recommends its `servicesNoTelegram` (D160); without a locale (tests, tools)
 * the lists stay as written.
 */
export function buildConfiguratorModel(
  categories: readonly CategoryLike[],
  input: ConfiguratorDataInput = configuratorData,
  currency: string = siteConfig.currency,
  locale?: string,
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
      const where = `configurator: goal "${goal.id}" option "${option.id}"`;
      for (const id of [...option.services, ...(option.servicesNoTelegram ?? [])]) {
        if (!serviceIds.has(id)) throw new Error(`${where} points at unknown service "${id}"`);
      }
      if (option.services.some(isTelegramService) && !option.servicesNoTelegram) {
        throw new Error(`${where} recommends Telegram without "servicesNoTelegram"`);
      }
      if (option.servicesNoTelegram?.some(isTelegramService)) {
        throw new Error(`${where}: "servicesNoTelegram" has a Telegram service`);
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
  const telegramRecommended = locale === undefined || data.telegramLocales.includes(locale);
  return {
    categories: categories.map((category) => category.id),
    telegramRecommended,
    services,
    goals: data.goals.map((goal) => ({
      id: goal.id,
      options: goal.options.map((option) => ({
        id: option.id,
        services: [
          ...(telegramRecommended
            ? option.services
            : (option.servicesNoTelegram ?? option.services)),
        ],
      })),
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

const cached = new Map<string, ConfiguratorModel>();

/**
 * Server-side: the model of this build (content categories + configurator
 * data) for an interface locale (D160); without one, the lists as written.
 */
export function getConfiguratorModel(locale?: string): ConfiguratorModel {
  const key = locale ?? '';
  let model = cached.get(key);
  if (!model) {
    model = buildConfiguratorModel(getCategories(), configuratorData, siteConfig.currency, locale);
    cached.set(key, model);
  }
  return model;
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
