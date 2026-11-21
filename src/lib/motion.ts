/**
 * HTML-layer motion timings (art direction: heavy, calm, no springs). CSS
 * durations of the entrance and exit themselves live in globals.css
 * (`.ui-enter`, `.ui-exit-layer`); keep `exitFadeMs` in sync with the latter.
 */
export const UI_MOTION = {
  /**
   * Home hero after a client-side return to the universe: if no camera flight
   * toward the universe has started after this many animation frames (and
   * `flightStartGraceMinMs`), the hero appears without waiting (no flight:
   * the camera was already there, or the scene is still loading). Counted in
   * frames, not milliseconds, because the scene starts its flight in its
   * first frame after the route change: on a slow GPU frames are long, and a
   * fixed delay would give up before that frame arrives.
   */
  flightStartGraceFrames: 4,
  flightStartGraceMinMs: 120,
  /**
   * A flight that stops reporting progress for this long (hidden tab, frozen
   * render loop) no longer holds the hero back. Re-armed by every update.
   */
  flightStallMs: 1200,
  /**
   * Last-resort cap for the hero wait. The scene clamps its frame delta, so
   * at very low frame rates a 1.4–1.8 s flight stretches in wall-clock time.
   */
  heroRevealMaxWaitMs: 5000,
  /**
   * Under prefers-reduced-motion the camera cuts behind a 300 ms canvas
   * crossfade, so the hero simply fades in shortly after the cut (half of it),
   * without waiting for any flight.
   */
  homeRevealDelayReducedMs: 150,
  /**
   * Exit fade of the outgoing hero / index / panel on client-side navigation
   * (visual N-03). None under reduced motion.
   */
  exitFadeMs: 150,
} as const;

/** True when the user asked the OS for reduced motion (client only). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
