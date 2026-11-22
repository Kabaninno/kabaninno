/**
 * Request configurator options (ids only). Labels live in
 * `messages/<locale>/ui.json` → `configurator.*`; service names and benefit
 * lines come from the content texts. Validated and combined with the
 * categories in `src/lib/configurator/model.ts`.
 *
 * The configurator is a short diagnostic (D149, round 3 D155): the visitor
 * names their industry, picks up to three goals, answers one plain question
 * per goal, and the configurator recommends services with an indicative
 * price and timeline (`pricePLN` and `timelineDays` of the services); they can
 * drop any of them or add others, then send the request.
 *
 * - `industries`: one choice on the first step; `other` asks for a few words.
 *   `industryGoals` names the 1–2 goals typical for an industry: they get an
 *   "Often chosen in your industry" mark, never a preselection.
 * - `goals`: what the visitor wants to improve. Each goal has one question; each
 *   answer (option) maps to the services recommended for it, as ids
 *   `"<category>/<slug>"` of `content/categories.ts`. Every goal ends with an
 *   `unknown` option ("Don't know") so nobody gets stuck. Texts:
 *   `configurator.goals.items.<goal>.{name,question,options.<option>}`.
 * - `have`: the shared question "What do you already have?". `none` is
 *   exclusive. Texts: `configurator.have.items.<id>`.
 * - Telegram is little used in Europe (round 5, A2, D160): the configurator
 *   recommends Telegram services only in `telegramLocales` (uk). Every answer
 *   that leads to a Telegram service has `servicesNoTelegram`, the list used
 *   in the other locales. In the manual mode every service stays available.
 */
export interface GoalOptionInput {
  id: string;
  /** Recommended services (`"<category>/<slug>"`), most important first. */
  services: readonly string[];
  /**
   * The list for the locales without Telegram recommendations; required when
   * `services` has a Telegram service, and itself without one.
   */
  servicesNoTelegram?: readonly string[];
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
  /** Locales whose recommendations may include Telegram services (D160). */
  telegramLocales: readonly string[];
  /** Industry ids of the first step; `other` is the free-text one. */
  industries: readonly string[];
  /** Goals typical for an industry (1–2 each), marked on the goals step. */
  industryGoals: Readonly<Record<string, readonly string[]>>;
  contact: { nameMin: number; nameMax: number; commentMax: number };
}

/** The ids shared by data, model and labels. */
export const OPTION_UNKNOWN = 'unknown';

/** The Telegram bots category: recommended only in `telegramLocales` (D160). */
export const TELEGRAM_CATEGORY = 'telegram';

/** Booking without Telegram: a web application with reminders (the owner's rule). */
const BOOKING_NO_TELEGRAM = ['web/web-apps', 'automation/notifications-reminders'];

export const configuratorData: ConfiguratorDataInput = {
  maxGoals: 3,
  maxRecommended: 4,
  goals: [
    {
      id: 'more-clients',
      options: [
        { id: 'google', services: ['web/corporate-websites'] },
        { id: 'social-ads', services: ['web/landing-pages'] },
        // Sales through a messenger → an AI assistant on the website.
        {
          id: 'messengers',
          services: ['telegram/sales-orders'],
          servicesNoTelegram: ['ai/ai-assistants'],
        },
        { id: OPTION_UNKNOWN, services: ['web/landing-pages'] },
      ],
    },
    {
      id: 'online-orders',
      options: [
        // Orders with few products → a landing page.
        {
          id: 'up-to-20',
          services: ['telegram/sales-orders'],
          servicesNoTelegram: ['web/landing-pages'],
        },
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
          servicesNoTelegram: BOOKING_NO_TELEGRAM,
        },
        {
          id: 'messengers',
          services: ['telegram/booking'],
          servicesNoTelegram: BOOKING_NO_TELEGRAM,
        },
        {
          id: 'website-inconvenient',
          services: ['web/web-apps', 'automation/notifications-reminders'],
        },
        {
          id: OPTION_UNKNOWN,
          services: ['telegram/booking'],
          servicesNoTelegram: BOOKING_NO_TELEGRAM,
        },
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
        // Customer support → an AI assistant.
        {
          id: 'telegram',
          services: ['telegram/customer-support'],
          servicesNoTelegram: ['ai/ai-assistants'],
        },
        { id: 'website-chat', services: ['ai/ai-assistants'] },
        {
          id: 'many-channels',
          services: ['ai/ai-assistants', 'automation/api-integrations'],
        },
        {
          id: 'repeated-questions',
          services: ['ai/ai-assistants', 'telegram/customer-support'],
          servicesNoTelegram: ['ai/ai-assistants'],
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
  telegramLocales: ['uk'],
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
  // My choice: the owner gave no table for this (D155).
  industryGoals: {
    retail: ['online-orders', 'more-clients'],
    services: ['booking', 'client-order'],
    'beauty-health': ['booking', 'more-clients'],
    food: ['online-orders', 'fast-replies'],
    education: ['booking', 'more-clients'],
    'real-estate': ['more-clients', 'client-order'],
    logistics: ['less-routine', 'see-numbers'],
    manufacturing: ['less-routine', 'client-order'],
    it: ['less-routine', 'see-numbers'],
  },
  contact: {
    /** Name length after trimming, in characters. */
    nameMin: 2,
    nameMax: 80,
    /** Comment length limit, in characters. */
    commentMax: 1000,
  },
};
