/**
 * Order of the request wizard steps. Labels live in
 * `messages/<locale>/ui.json` → `configurator.steps.<id>` (and `hints.<id>`);
 * validation and persistence are in `src/lib/configurator/`.
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
