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
 */
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
  /** Industry ids of the first step; `other` is the free-text one. */
  industries: readonly string[];
  /** Goals typical for an industry (1–2 each), marked on the goals step. */
  industryGoals: Readonly<Record<string, readonly string[]>>;
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
