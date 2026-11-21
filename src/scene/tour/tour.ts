/**
 * Idle tour (B1): while the visitor has not interacted, the category nodes
 * light up one by one (label in the scene, card in the list through the shared
 * `highlighted` store field), in content order, a few seconds each, for at most
 * two passes. Pure and three-free; `IdleTour` owns the timers, the events and
 * the store writes and only feeds this state machine.
 */
export const TOUR = {
  /** One node: lit for `litMs`, then a short dark gap so the label fades before it moves on. */
  stepMs: 3000,
  gapMs: 400,
  /** Whole passes over the categories (≈ 30 s with five of them). */
  passes: 2,
  /** The page must be settled and idle this long before the first node lights (hero entrance). */
  startDelayMs: 1200,
} as const;

export type TourConfig = {
  stepMs: number;
  gapMs: number;
  passes: number;
  startDelayMs: number;
};

export type TourStatus = 'waiting' | 'running' | 'stopped';

export interface TourState {
  status: TourStatus;
  /** Time (ms) the tour's conditions have been continuously true while waiting. */
  readyMs: number;
  /** Time (ms) played while running (paused time does not count). */
  playedMs: number;
  /** The highlight id the tour has written and not cleared, else null. */
  lit: string | null;
}

export function createTour(): TourState {
  return { status: 'waiting', readyMs: 0, playedMs: 0, lit: null };
}

export interface TourStepInput {
  /** Highlight ids in the order they light up (categories, content order). */
  ids: readonly string[];
  /** Elapsed time since the previous step, ms. */
  dtMs: number;
  /**
   * The tour may advance now: universe view settled, intro over, nothing in
   * flight, tab visible. False pauses it (visibility) or restarts the start
   * delay (waiting); a hard stop goes through `stopTour`.
   */
  canRun: boolean;
}

/** What the caller must do with the store after a step. */
export type TourAction = { type: 'none' } | { type: 'light'; id: string } | { type: 'clear' };

const NONE: TourAction = { type: 'none' };

/**
 * Which node is lit after `playedMs` of play: its index in `ids` and whether
 * the step is in its dark gap, or null once the passes are over (or there is
 * nothing to light).
 */
export function tourPositionAt(
  playedMs: number,
  count: number,
  config: TourConfig = TOUR,
): { index: number; lit: boolean } | null {
  if (count <= 0 || config.passes <= 0 || playedMs < 0) return null;
  const steps = count * config.passes;
  const step = Math.floor(playedMs / config.stepMs);
  if (step >= steps) return null;
  const within = playedMs - step * config.stepMs;
  return { index: step % count, lit: within < config.stepMs - config.gapMs };
}

/** Total play time of the tour for `count` nodes, ms. */
export function tourDurationMs(count: number, config: TourConfig = TOUR): number {
  return Math.max(0, count) * config.passes * config.stepMs;
}

/**
 * Advances the tour by `dtMs`. Returns the next state and the store action:
 * waiting → running after `startDelayMs` of continuous `canRun`; running
 * lights `ids[index]` for the lit part of each step and clears in the gaps;
 * after the last step the highlight is cleared and the tour stops for good.
 * A stopped tour never does anything.
 */
export function advanceTour(
  state: TourState,
  input: TourStepInput,
  config: TourConfig = TOUR,
): { state: TourState; action: TourAction } {
  if (state.status === 'stopped') return { state, action: NONE };
  if (input.ids.length === 0) return stopTour(state);
  const dtMs = Math.max(0, input.dtMs);

  if (state.status === 'waiting') {
    if (!input.canRun) return { state: { ...state, readyMs: 0 }, action: NONE };
    const readyMs = state.readyMs + dtMs;
    if (readyMs < config.startDelayMs) return { state: { ...state, readyMs }, action: NONE };
    // Start: the first step lights immediately.
    return advanceTour(
      { ...state, status: 'running', readyMs, playedMs: 0 },
      { ...input, dtMs: 0 },
      config,
    );
  }

  // Running: paused while the conditions do not hold (hidden tab).
  const playedMs = input.canRun ? state.playedMs + dtMs : state.playedMs;
  const position = tourPositionAt(playedMs, input.ids.length, config);
  if (!position) return stopTour({ ...state, playedMs });
  const wanted = position.lit ? (input.ids[position.index] ?? null) : null;
  if (wanted === state.lit) return { state: { ...state, playedMs }, action: NONE };
  return {
    state: { ...state, playedMs, lit: wanted },
    action: wanted ? { type: 'light', id: wanted } : { type: 'clear' },
  };
}

/**
 * Stops the tour for good (interaction, foreign highlight, route change,
 * flight, the end): clears the highlight it wrote, never anyone else's.
 */
export function stopTour(state: TourState): { state: TourState; action: TourAction } {
  const stopped: TourState = { ...state, status: 'stopped', lit: null };
  return { state: stopped, action: state.lit ? { type: 'clear' } : NONE };
}

/**
 * Whether a change of the store's `highlighted` field is the tour's own
 * write. Anything else (a hover, a keyboard focus, a clear by someone else)
 * is "someone else's" and ends the tour.
 */
export function isOwnHighlight(next: string | null, written: string | null): boolean {
  return next === written;
}
