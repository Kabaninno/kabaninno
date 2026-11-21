import { describe, expect, it } from 'vitest';
import type { FlightState } from '@/store/scene';
import {
  HERO_REVEAL_PROGRESS,
  PANEL_REVEAL_PROGRESS,
  initialHeroGate,
  isGateFlight,
  revealGateStep,
  routeGate,
  UNIVERSE_GATE,
  type HeroGateEvent,
  type HeroGateState,
} from './hero-reveal';

const idle: FlightState = { active: false, progress: 1, to: null };
const toHome = (progress: number): FlightState => ({ active: true, progress, to: '/' });
const flight = (value: FlightState): HeroGateEvent => ({ type: 'flight', flight: value });

const isFlightToUniverse = (value: FlightState) => isGateFlight(value, UNIVERSE_GATE);

function run(events: HeroGateEvent[], from: HeroGateState = initialHeroGate): HeroGateState {
  return events.reduce((state, event) => revealGateStep(state, event, UNIVERSE_GATE), from);
}

describe('isGateFlight with UNIVERSE_GATE', () => {
  it('accepts flights to the home path with or without a locale', () => {
    expect(isFlightToUniverse(toHome(0.2))).toBe(true);
    expect(isFlightToUniverse({ active: true, progress: 0, to: '/pl/' })).toBe(true);
    expect(isFlightToUniverse({ active: true, progress: 0, to: '/uk' })).toBe(true);
  });

  it('rejects idle state and flights elsewhere', () => {
    expect(isFlightToUniverse(idle)).toBe(false);
    expect(isFlightToUniverse({ active: false, progress: 1, to: '/' })).toBe(false);
    expect(isFlightToUniverse({ active: true, progress: 0, to: '/services/web/' })).toBe(false);
    expect(isFlightToUniverse({ active: true, progress: 0, to: null })).toBe(false);
  });
});

describe('revealGateStep with UNIVERSE_GATE (home hero)', () => {
  it('reveals at the progress threshold, not before', () => {
    const waiting = run([flight(toHome(0)), flight(toHome(0.3)), flight(toHome(0.59))]);
    expect(waiting).toEqual({ sawFlight: true, revealed: null });
    expect(run([flight(toHome(HERO_REVEAL_PROGRESS))], waiting).revealed).toBe('flight');
  });

  it('reveals immediately when the flight is already past the threshold on mount', () => {
    expect(run([flight(toHome(0.8))]).revealed).toBe('flight');
  });

  it('reveals when the awaited flight ends early (interrupted by the user)', () => {
    expect(run([flight(toHome(0.2)), flight(idle)]).revealed).toBe('flight-end');
  });

  it('keeps waiting through a stale flight elsewhere until the grace period', () => {
    const stale = { active: true, progress: 0.5, to: '/services/crm/' };
    const state = run([flight(stale), flight(idle)]);
    expect(state.revealed).toBeNull();
    expect(run([{ type: 'grace' }], state).revealed).toBe('no-flight');
  });

  it('reveals after the grace period when no flight starts (no WebGL, scene failed)', () => {
    expect(run([flight(idle), { type: 'grace' }]).revealed).toBe('no-flight');
  });

  it('ignores the grace period once a flight to the universe is running', () => {
    expect(run([flight(toHome(0.1)), { type: 'grace' }]).revealed).toBeNull();
  });

  it('reveals when a running flight stops reporting progress', () => {
    expect(run([flight(toHome(0.3)), { type: 'stall' }]).revealed).toBe('stall');
  });

  it('ignores the stall timer before any flight was seen', () => {
    expect(run([flight(idle), { type: 'stall' }]).revealed).toBeNull();
  });

  it('always reveals on the hard timeout', () => {
    expect(run([flight(toHome(0.1)), { type: 'timeout' }]).revealed).toBe('timeout');
    expect(run([{ type: 'timeout' }]).revealed).toBe('timeout');
  });

  it('is final once revealed', () => {
    const revealed = run([flight(toHome(0.7))]);
    expect(run([{ type: 'timeout' }, flight(idle), { type: 'grace' }], revealed)).toBe(revealed);
  });
});

describe('routeGate (content panels, V2-06)', () => {
  const gate = routeGate('/services/web/');
  const to = (path: string, progress: number): FlightState => ({
    active: true,
    progress,
    to: path,
  });

  it('waits for the flight to its own route and opens at 0.35', () => {
    const waiting = [flight(to('/services/web/', 0.1)), flight(to('/services/web/', 0.34))].reduce(
      (state, event) => revealGateStep(state, event, gate),
      initialHeroGate,
    );
    expect(waiting).toEqual({ sawFlight: true, revealed: null });
    expect(
      revealGateStep(waiting, flight(to('/services/web/', PANEL_REVEAL_PROGRESS)), gate).revealed,
    ).toBe('flight');
  });

  it('matches paths regardless of locale prefix and trailing slash', () => {
    expect(isGateFlight(to('/pl/services/web', 0), gate)).toBe(true);
    expect(isGateFlight(to('/services/web', 0), gate)).toBe(true);
  });

  it('ignores flights elsewhere (the universe, another system, a planet of it)', () => {
    expect(isGateFlight(to('/', 0.9), gate)).toBe(false);
    expect(isGateFlight(to('/services/crm/', 0.9), gate)).toBe(false);
    expect(isGateFlight(to('/services/web/landing-pages/', 0.9), gate)).toBe(false);
  });

  it('keeps the shared fallbacks: no flight → grace, early end → flight-end', () => {
    expect(revealGateStep(initialHeroGate, { type: 'grace' }, gate).revealed).toBe('no-flight');
    const flying = revealGateStep(initialHeroGate, flight(to('/services/web/', 0.2)), gate);
    expect(revealGateStep(flying, flight(idle), gate).revealed).toBe('flight-end');
  });

  it('opens earlier than the hero gate', () => {
    expect(PANEL_REVEAL_PROGRESS).toBeLessThan(HERO_REVEAL_PROGRESS);
  });
});
