/**
 * Request configurator options (ids only). Labels live in
 * `messages/<locale>/ui.json` → `configurator.*`; service names come from the
 * content texts. Validated and combined with the categories in
 * `src/lib/configurator/model.ts`.
 *
 * - Step 1 (solution type) lists every category of `content/categories.ts`.
 * - Step 2 (features) lists the selected categories' services plus the extra
 *   features below. A category without an entry here simply has no extras,
 *   so adding a category needs no change in this file or in code.
 * - Extra feature ids are global label keys (`configurator.extras.<id>`) and
 *   must not repeat a service slug of the same category.
 * - Budgets follow the choice (D138): every service and extra feature has a
 *   complexity level 1–3 (`complexity`); the budget step offers the ranges of
 *   the highest level among the selected features (`budgetLevels`). All the
 *   numbers live here, in PLN netto; nothing in code needs to change to edit them.
 */
export type ComplexityLevel = 1 | 2 | 3;

/** A budget range in `siteConfig.currency` (netto): `min` inclusive, `max` exclusive. */
export interface BudgetRangeInput {
  min?: number;
  max?: number;
}

export interface ConfiguratorDataInput {
  /** Extra feature ids per category id; categories without an entry have none. */
  extraFeatures: Record<string, readonly string[]>;
  /**
   * Complexity level of every feature, by id `"<category>/<key>"` (services:
   * their slug; extras: their id). Every service and extra must be listed.
   */
  complexity: Record<string, ComplexityLevel>;
  /**
   * Budget ranges offered per complexity level (PLN netto), from the lowest
   * to the highest. A range's id is derived from its numbers (`up-to-1500`,
   * `1500-3000`, `over-3000`), so the same range under two levels is one
   * option with one label. "Not sure yet" is always added by the code.
   */
  budgetLevels: Record<ComplexityLevel, readonly BudgetRangeInput[]>;
  industries: readonly string[];
  companySizes: readonly string[];
  timelines: readonly string[];
  contact: { nameMin: number; nameMax: number; commentMax: number };
}

export const configuratorData: ConfiguratorDataInput = {
  extraFeatures: {
    web: ['multilingual', 'cms', 'seo', 'online-payments'],
    crm: ['data-migration', 'team-training', 'telephony', 'mobile-access'],
    automation: ['e-invoicing', 'erp-integration', 'scheduled-reports'],
    ai: ['knowledge-base', 'voice', 'human-handoff'],
    telegram: ['online-payments', 'crm-sync', 'broadcasts'],
  },
  complexity: {
    // Websites and web apps
    'web/landing-pages': 1,
    'web/corporate-websites': 2,
    'web/online-stores': 2,
    'web/web-apps': 3,
    'web/multilingual': 2,
    'web/cms': 2,
    'web/seo': 1,
    'web/online-payments': 2,
    // CRM
    'crm/sales-funnels': 2,
    'crm/reports-dashboards': 2,
    'crm/crm-implementation': 3,
    'crm/custom-crm': 3,
    'crm/data-migration': 2,
    'crm/team-training': 1,
    'crm/telephony': 3,
    'crm/mobile-access': 2,
    // Automation
    'automation/document-automation': 1,
    'automation/notifications-reminders': 1,
    'automation/api-integrations': 2,
    'automation/data-processing': 2,
    'automation/e-invoicing': 2,
    'automation/erp-integration': 3,
    'automation/scheduled-reports': 1,
    // AI
    'ai/content-generation': 2,
    'ai/ai-assistants': 3,
    'ai/ai-document-processing': 3,
    'ai/ai-analytics': 3,
    'ai/knowledge-base': 3,
    'ai/voice': 3,
    'ai/human-handoff': 2,
    // Telegram bots
    'telegram/customer-support': 1,
    'telegram/booking': 2,
    'telegram/sales-orders': 2,
    'telegram/mini-apps': 3,
    'telegram/online-payments': 2,
    'telegram/crm-sync': 2,
    'telegram/broadcasts': 1,
  },
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
  companySizes: ['solo', '2-10', '11-50', '51-200', '200-plus'],
  timelines: ['asap', '1-month', '1-3-months', '3-plus-months', 'flexible'],
  contact: {
    /** Name length after trimming, in characters. */
    nameMin: 2,
    nameMax: 80,
    /** Comment length limit, in characters. */
    commentMax: 1000,
  },
};
