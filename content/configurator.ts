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
 */
export interface ConfiguratorDataInput {
  /** Extra feature ids per category id; categories without an entry have none. */
  extraFeatures: Record<string, readonly string[]>;
  industries: readonly string[];
  companySizes: readonly string[];
  budgetRanges: readonly { id: string; min?: number; max?: number }[];
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
  /** Budget ranges in `siteConfig.currency` (PLN); `min` inclusive, `max` exclusive. */
  budgetRanges: [
    { id: 'up-to-5k', max: 5000 },
    { id: '5k-15k', min: 5000, max: 15000 },
    { id: '15k-40k', min: 15000, max: 40000 },
    { id: '40k-plus', min: 40000 },
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
