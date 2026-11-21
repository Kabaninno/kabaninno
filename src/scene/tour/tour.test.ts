import { describe, expect, it } from 'vitest';
import {
  TOUR,
  advanceTour,
  createTour,
  isOwnHighlight,
  stopTour,
  tourDurationMs,
  tourPositionAt,
  type TourAction,
  type TourState,
} from './tour';

const IDS = [
  'category:web',
  'category:crm',
  'category:automation',
  'category:ai',
  'category:telegram',
];

/** Runs the tour with a fixed tick, collecting the actions in order. */
function run(
  totalMs: number,
  options: { tickMs?: number; canRun?: (atMs: number) => boolean; ids?: readonly string[] } = {},
) {
  const { tickMs = 250, canRun = () => true, ids = IDS } = options;
  let state: TourState = createTour();
  const actions: Array<{ at: number; action: TourAction }> = [];
  for (let at = tickMs; at <= totalMs; at += tickMs) {
    const result = advanceTour(state, { ids, dtMs: tickMs, canRun: canRun(at) });
    state = result.state;
    if (result.action.type !== 'none') actions.push({ at, action: result.action });
  }
  return { state, actions };
}

const lights = (actions: Array<{ action: TourAction }>) =>
  actions.flatMap(({ action }) => (action.type === 'light' ? [action.id] : []));

describe('tourPositionAt', () => {
  it('lights the nodes in order, with a dark gap at the end of each step', () => {
    expect(tourPositionAt(0, 5)).toEqual({ index: 0, lit: true });
    expect(tourPositionAt(TOUR.stepMs - TOUR.gapMs - 1, 5)).toEqual({ index: 0, lit: true });
    expect(tourPositionAt(TOUR.stepMs - TOUR.gapMs, 5)).toEqual({ index: 0, lit: false });
    expect(tourPositionAt(TOUR.stepMs, 5)).toEqual({ index: 1, lit: true });
    expect(tourPositionAt(TOUR.stepMs * 4 + 10, 5)).toEqual({ index: 4, lit: true });
  });

  it('wraps into a second pass and ends after exactly two', () => {
    expect(tourPositionAt(TOUR.stepMs * 5 + 10, 5)).toEqual({ index: 0, lit: true });
    expect(tourPositionAt(TOUR.stepMs * 9 + 10, 5)).toEqual({ index: 4, lit: true });
    expect(tourPositionAt(TOUR.stepMs * 10, 5)).toBeNull();
    expect(tourPositionAt(TOUR.stepMs * 10 + 5000, 5)).toBeNull();
  });

  it('has nothing to light without nodes or passes', () => {
    expect(tourPositionAt(0, 0)).toBeNull();
    expect(tourPositionAt(0, 5, { ...TOUR, passes: 0 })).toBeNull();
    expect(tourPositionAt(-1, 5)).toBeNull();
  });

  it('takes about 3 s per node and about 30 s for two passes of five', () => {
    expect(TOUR.stepMs).toBe(3000);
    expect(tourDurationMs(5)).toBe(30000);
    expect(tourDurationMs(0)).toBe(0);
  });
});

describe('advanceTour', () => {
  it('waits for the start delay of continuous readiness, then lights the first node at once', () => {
    const early = run(TOUR.startDelayMs - 250);
    expect(early.actions).toEqual([]);
    expect(early.state.status).toBe('waiting');
    const started = run(TOUR.startDelayMs + 250);
    expect(started.state.status).toBe('running');
    expect(lights(started.actions)).toEqual([IDS[0]]);
  });

  it('restarts the delay when the conditions drop while waiting', () => {
    // Not ready for a moment (intro still playing): the delay counts from the last gap.
    const result = run(3000, { canRun: (at) => at < 1000 || at > 1250 });
    expect(result.actions.length).toBeGreaterThan(0);
    const firstAt = result.actions[0]!.at;
    expect(firstAt).toBeGreaterThanOrEqual(1250 + TOUR.startDelayMs);
  });

  it('plays the categories in content order for two passes, then clears and stops', () => {
    const result = run(TOUR.startDelayMs + tourDurationMs(5) + 2000);
    expect(lights(result.actions)).toEqual([...IDS, ...IDS]);
    expect(result.state.status).toBe('stopped');
    const last = result.actions[result.actions.length - 1]!.action;
    expect(last).toEqual({ type: 'clear' });
    expect(result.state.lit).toBeNull();
  });

  it('clears between nodes so the label can fade before it moves', () => {
    const result = run(TOUR.startDelayMs + TOUR.stepMs * 2 + 250);
    const types = result.actions.map(({ action }) => action.type);
    expect(types.slice(0, 4)).toEqual(['light', 'clear', 'light', 'clear']);
  });

  it('pauses while it may not run (hidden tab) without losing its place', () => {
    const delay = TOUR.startDelayMs;
    const hiddenFrom = delay + 1500;
    const hiddenTo = hiddenFrom + 20000;
    const result = run(delay + 6000 + 20000, {
      canRun: (at) => at <= hiddenFrom || at > hiddenTo,
    });
    // Two nodes have been lit in 6 s of play, however long the tab was hidden.
    expect(lights(result.actions)).toEqual(
      [IDS[0], IDS[1], IDS[2]].slice(0, lights(result.actions).length),
    );
    expect(lights(result.actions).length).toBeGreaterThanOrEqual(2);
    expect(result.state.status).toBe('running');
    expect(result.state.playedMs).toBeLessThanOrEqual(6250);
  });

  it('never does anything once stopped, and with no nodes it stops at once', () => {
    const stopped = stopTour(createTour()).state;
    const next = advanceTour(stopped, { ids: IDS, dtMs: 5000, canRun: true });
    expect(next.state).toBe(stopped);
    expect(next.action).toEqual({ type: 'none' });
    const empty = advanceTour(createTour(), { ids: [], dtMs: 250, canRun: true });
    expect(empty.state.status).toBe('stopped');
  });
});

describe('stopTour', () => {
  it('clears the highlight it wrote, but only that one', () => {
    const running = run(TOUR.startDelayMs + 500).state;
    expect(running.lit).toBe(IDS[0]);
    const result = stopTour(running);
    expect(result.state.status).toBe('stopped');
    expect(result.action).toEqual({ type: 'clear' });
    // Nothing lit (still waiting, or in a gap): nothing to clear.
    expect(stopTour(createTour()).action).toEqual({ type: 'none' });
  });
});

describe('isOwnHighlight', () => {
  it('tells the tour its own write from anyone else’s', () => {
    expect(isOwnHighlight('category:web', 'category:web')).toBe(true);
    expect(isOwnHighlight(null, null)).toBe(true);
    expect(isOwnHighlight('category:crm', 'category:web')).toBe(false);
    expect(isOwnHighlight(null, 'category:web')).toBe(false);
    expect(isOwnHighlight('category:web', null)).toBe(false);
  });
});
