/**
 * Order of the request wizard steps. Labels live in
 * `messages/<locale>/ui.json` → `configurator.steps.<id>`. The wizard itself
 * (validation, state, draft persistence) arrives in M4.
 */
export const CONFIGURATOR_STEPS = [
  'type',
  'features',
  'business',
  'budget',
  'timeline',
  'contact',
  'summary',
] as const;

export type ConfiguratorStepId = (typeof CONFIGURATOR_STEPS)[number];
