import type { FlightState } from '@/store/scene';
import { routeToSceneState, sceneStateToPath } from './route-state';

/**
 * Entrances timed to the camera flight (D29, D44):
 * - the home hero appears once the flight back to the universe has covered
 *   `HERO_REVEAL_PROGRESS` (visual N-04): the headline never lands on a core
 *   still rushing past;
 * - a content panel appears once the flight to its route has covered
 *   `PANEL_REVEAL_PROGRESS` (visual V2-06): the camera has turned toward the
 *   target, so the target node is not hidden under the panel at the start.
 */
export const HERO_REVEAL_PROGRESS = 0.6;
export const PANEL_REVEAL_PROGRESS = 0.35;

/** Why an entrance was revealed (written to `data-reveal-reason` for QA). */
export type HeroRevealReason =
  /** The awaited flight reached the gate's progress. */
  | 'flight'
  /** The flight we waited for settled or was interrupted (user input) earlier. */
  | 'flight-end'
  /** No matching flight started within the grace period. */
  | 'no-flight'
  /** The flight stopped reporting progress (hidden tab, frozen render loop). */
  | 'stall'
  /** Last-resort cap: the flight is far too slow to wait for. */
  | 'timeout';

export interface HeroGateState {
  /** A flight to the gate's destination has been seen. */
  sawFlight: boolean;
  revealed: HeroRevealReason | null;
}

export type HeroGateEvent =
  | { type: 'flight'; flight: FlightState }
  | { type: 'grace' }
  | { type: 'stall' }
  | { type: 'timeout' };

/** Which flight a gate waits for and how far it must get. */
export interface RevealGateConfig {
  progress: number;
  /** True for the locale-less destination path of the awaited flight. */
  matches: (to: string) => boolean;
}

export const initialHeroGate: HeroGateState = { sawFlight: false, revealed: null };

/** Canonical locale-less path of a route ("/pl/services/web" → "/services/web/"). */
function canonicalPath(path: string): string {
  return sceneStateToPath(routeToSceneState(path));
}

/** The home hero: flights to the universe overview, revealed at 0.6. */
export const UNIVERSE_GATE: RevealGateConfig = {
  progress: HERO_REVEAL_PROGRESS,
  matches: (to) => routeToSceneState(to).mode === 'universe',
};

/** A content panel: flights to its own route, revealed at 0.35. */
export function routeGate(pathname: string): RevealGateConfig {
  const target = canonicalPath(pathname);
  return { progress: PANEL_REVEAL_PROGRESS, matches: (to) => canonicalPath(to) === target };
}

/** True while the camera is flying toward the gate's destination. */
export function isGateFlight(flight: FlightState, config: RevealGateConfig): boolean {
  return flight.active && flight.to !== null && config.matches(flight.to);
}

/**
 * Reducer of a reveal gate. Fed with the current flight state on mount and on
 * every flight update, plus timers: the grace period (no flight started),
 * the stall timer (re-armed by every flight update) and a hard cap. Once
 * `revealed` is set the state is final.
 */
export function revealGateStep(
  state: HeroGateState,
  event: HeroGateEvent,
  config: RevealGateConfig,
): HeroGateState {
  if (state.revealed) return state;
  switch (event.type) {
    case 'flight': {
      if (isGateFlight(event.flight, config)) {
        if (event.flight.progress >= config.progress) {
          return { sawFlight: true, revealed: 'flight' };
        }
        return state.sawFlight ? state : { ...state, sawFlight: true };
      }
      // The flight we were waiting for is over (settled early or interrupted).
      return state.sawFlight ? { ...state, revealed: 'flight-end' } : state;
    }
    case 'grace':
      return state.sawFlight ? state : { ...state, revealed: 'no-flight' };
    case 'stall':
      return state.sawFlight ? { ...state, revealed: 'stall' } : state;
    case 'timeout':
      return { ...state, revealed: 'timeout' };
  }
}
