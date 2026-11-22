/**
 * The request wizard is a short diagnostic (D149), five steps:
 * goals → details (one question per goal) → solution (recommended services)
 * → plan (budget, timeline, industry) → contact and summary.
 *
 * Labels live in `messages/<locale>/ui.json` → `configurator.steps.<id>` (the
 * short chip name), `titles.<id>` (the step's heading) and `hints.<id>`;
 * validation and persistence are in `src/lib/configurator/`.
 */
export const CONFIGURATOR_STEPS = ['goals', 'details', 'solution', 'plan', 'contact'] as const;

export type ConfiguratorStepId = (typeof CONFIGURATOR_STEPS)[number];

/**
 * `guided`: the visitor answers the goal questions and gets a recommendation.
 * `manual` ("I know what I need"): the details step is skipped and the
 * visitor picks the services themselves.
 */
export type ConfiguratorMode = 'guided' | 'manual';

/** The steps of a mode, in order (manual skips the details step). */
export function stepsFor(mode: ConfiguratorMode): readonly ConfiguratorStepId[] {
  return mode === 'manual'
    ? CONFIGURATOR_STEPS.filter((step) => step !== 'details')
    : CONFIGURATOR_STEPS;
}
