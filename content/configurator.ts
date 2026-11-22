/**
 * Request configurator options (ids only). Labels live in
 * `messages/<locale>/ui.json` → `configurator.*`; service names and benefit
 * lines come from the content texts. Validated and combined with the
 * categories in `src/lib/configurator/model.ts`.
 *
 * The configurator is a short diagnostic (D149): the visitor picks up to
 * three goals, answers one plain question per goal, and the configurator
 * recommends services; they can drop any of them or add others, then pick a
 * budget and send the request.
 *
 * - `goals`: what the visitor wants to improve. Each goal has one question; each
 *   answer (option) maps to the services recommended for it, as ids
 *   `"<category>/<slug>"` of `content/categories.ts`. Every goal ends with an
 *   `unknown` option ("Don't know") so nobody gets stuck. Texts:
 *   `configurator.goals.items.<goal>.{name,question,options.<option>}`.
 * - `have`: the shared question "What do you already have?". `none` is
 *   exclusive. Texts: `configurator.have.items.<id>`.
 * - Budgets follow the choice (D138): every service has a complexity level
 *   1–3 (`complexity`); the budget step offers the ranges of the highest level
 *   among the selected services (`budgetLevels`), and `consultationLevel` when
 *   nothing is selected (a consultation request). All the numbers live here,
 *   in PLN netto; nothing in code needs to change to edit them.
 */
export type ComplexityLevel = 1 | 2 | 3;

/** A budget range in `siteConfig.currency` (netto): `min` inclusive, `max` exclusive. */
export interface BudgetRangeInput {
  min?: number;
  max?: number;
}

export interface GoalOptionInput {
  id: string;
  /** Recommended services (`"<category>/<slug>"`), most important first. */
  services: readonly string[];
}

export interface GoalInput {
  id: string;
  options: readonly GoalOptionInput[];
}

export interface ConfiguratorDataInput {
  /** At most this many goals can be picked. */
  maxGoals: number;
  /** At most this many services are recommended at once. */
  maxRecommended: number;
  goals: readonly GoalInput[];
  /** Ids of "What do you already have?"; `none` is the exclusive "nothing of these". */
  have: readonly string[];
  /**
   * Complexity level of every service, by id `"<category>/<slug>"`. Every
   * service of `content/categories.ts` must be listed.
   */
  complexity: Record<string, ComplexityLevel>;
  /** The level of a request with no services yet (a consultation). */
  consultationLevel: ComplexityLevel;
  /**
   * Budget ranges offered per complexity level (PLN netto), from the lowest
   * to the highest. A range's id is derived from its numbers (`up-to-1500`,
   * `1500-3000`, `over-3000`), so the same range under two levels is one
   * option with one label. "Not sure yet" is always added by the code.
   */
  budgetLevels: Record<ComplexityLevel, readonly BudgetRangeInput[]>;
  industries: readonly string[];
  timelines: readonly string[];
  contact: { nameMin: number; nameMax: number; commentMax: number };
}

/** The ids shared by data, model and labels. */
export const OPTION_UNKNOWN = 'unknown';

export const configuratorData: ConfiguratorDataInput = {
  maxGoals: 3,
  maxRecommended: 4,
  goals: [
    {
      id: 'more-clients',
      options: [
        { id: 'google', services: ['web/corporate-websites'] },
        { id: 'social-ads', services: ['web/landing-pages'] },
        { id: 'messengers', services: ['telegram/sales-orders'] },
        { id: OPTION_UNKNOWN, services: ['web/landing-pages'] },
      ],
    },
    {
      id: 'online-orders',
      options: [
        { id: 'up-to-20', services: ['telegram/sales-orders'] },
        { id: '20-200', services: ['web/online-stores'] },
        { id: 'over-200', services: ['web/online-stores', 'automation/api-integrations'] },
        { id: OPTION_UNKNOWN, services: ['web/online-stores'] },
      ],
    },
    {
      id: 'booking',
      options: [
        {
          id: 'phone',
          services: ['telegram/booking', 'automation/notifications-reminders'],
        },
        { id: 'messengers', services: ['telegram/booking'] },
        {
          id: 'website-inconvenient',
          services: ['web/web-apps', 'automation/notifications-reminders'],
        },
        { id: OPTION_UNKNOWN, services: ['telegram/booking'] },
      ],
    },
    {
      id: 'client-order',
      options: [
        { id: 'head-notebook', services: ['crm/crm-implementation'] },
        {
          id: 'spreadsheets',
          services: ['crm/crm-implementation', 'automation/api-integrations'],
        },
        { id: 'program-inconvenient', services: ['crm/custom-crm'] },
        { id: OPTION_UNKNOWN, services: ['crm/crm-implementation'] },
      ],
    },
    {
      id: 'less-routine',
      options: [
        { id: 'documents', services: ['automation/document-automation'] },
        { id: 'reminders', services: ['automation/notifications-reminders'] },
        { id: 'data-transfer', services: ['automation/api-integrations'] },
        { id: 'emails-requests', services: ['ai/ai-document-processing'] },
        { id: OPTION_UNKNOWN, services: ['automation/api-integrations'] },
      ],
    },
    {
      // Row cut off in the brief ("Швидко відповідати…"); completed by us (D149).
      id: 'fast-replies',
      options: [
        { id: 'telegram', services: ['telegram/customer-support'] },
        { id: 'website-chat', services: ['ai/ai-assistants'] },
        {
          id: 'many-channels',
          services: ['ai/ai-assistants', 'automation/api-integrations'],
        },
        {
          id: 'repeated-questions',
          services: ['ai/ai-assistants', 'telegram/customer-support'],
        },
        { id: OPTION_UNKNOWN, services: ['ai/ai-assistants'] },
      ],
    },
    {
      // Not in the brief either: it makes the reporting and analytics services reachable (D149).
      id: 'see-numbers',
      options: [
        { id: 'sales-clients', services: ['crm/reports-dashboards'] },
        {
          id: 'team-processes',
          services: ['crm/reports-dashboards', 'automation/data-processing'],
        },
        { id: 'feedback', services: ['ai/ai-analytics'] },
        { id: OPTION_UNKNOWN, services: ['crm/reports-dashboards'] },
      ],
    },
  ],
  have: ['website', 'social', 'tracking', 'none'],
  complexity: {
    // Websites and web apps
    'web/landing-pages': 1,
    'web/corporate-websites': 2,
    'web/online-stores': 2,
    'web/web-apps': 3,
    // CRM
    'crm/sales-funnels': 2,
    'crm/reports-dashboards': 2,
    'crm/crm-implementation': 3,
    'crm/custom-crm': 3,
    // Automation
    'automation/document-automation': 1,
    'automation/notifications-reminders': 1,
    'automation/api-integrations': 2,
    'automation/data-processing': 2,
    // AI
    'ai/content-generation': 2,
    'ai/ai-assistants': 3,
    'ai/ai-document-processing': 3,
    'ai/ai-analytics': 3,
    // Telegram bots
    'telegram/customer-support': 1,
    'telegram/booking': 2,
    'telegram/sales-orders': 2,
    'telegram/mini-apps': 3,
  },
  consultationLevel: 2,
  budgetLevels: {
    // Landing page, simple bot, simple automation.
    1: [{ max: 1500 }, { min: 1500, max: 3000 }, { min: 3000 }],
    // Website, store, integrations, a bot with orders.
    2: [{ max: 3000 }, { min: 3000, max: 6000 }, { min: 6000 }],
    // CRM, AI, web application.
    3: [{ max: 5000 }, { min: 5000, max: 10000 }, { min: 10000 }],
  },
  industries: [
    'retail',
    'services',
    'beauty-health',
    'food',
    'education',
    'real-estate',
    'logistics',
    'manufacturing',
    'it',
    'other',
  ],
  timelines: ['asap', '1-month', '1-3-months', '3-plus-months', 'flexible'],
  contact: {
    /** Name length after trimming, in characters. */
    nameMin: 2,
    nameMax: 80,
    /** Comment length limit, in characters. */
    commentMax: 1000,
  },
};
