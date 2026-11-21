/**
 * HTML-layer motion timings (art direction: heavy, calm, no springs). CSS
 * durations of the entrance itself live in globals.css (`.ui-enter`).
 */
export const UI_MOTION = {
  /**
   * Delay before the home hero and category index fade in after a client-side
   * navigation back to the universe: the hero waits until the camera flight is
   * mostly done (~60% of it), so the headline never lands on a bright core
   * still flying past. Tune together with the camera flight duration (M2).
   * Never applied on the initial page load.
   */
  homeRevealDelayMs: 800,
  /**
   * Same, under prefers-reduced-motion: the camera cuts behind a 300 ms canvas
   * crossfade, so the hero appears right after the cut (half of it).
   */
  homeRevealDelayReducedMs: 150,
} as const;
