'use client';

import {
  isGateFlight,
  revealGateStep,
  initialHeroGate,
  routeGate,
  UNIVERSE_GATE,
  type HeroGateEvent,
  type RevealGateConfig,
} from '@/lib/hero-reveal';
import { UI_MOTION } from '@/lib/motion';
import { useSceneStore, type FlightState } from '@/store/scene';
import type { EnterGate } from './use-enter-animation';

/** The persistent canvas exists (SceneRoot mounted it and WebGL works). */
function sceneCanvasPresent(): boolean {
  return document.querySelector('[data-scene-root] canvas') !== null;
}

/**
 * Entrance gate timed to a camera flight (D44): opens when the flight to the
 * gate's destination reaches its progress, or when that flight ends early.
 * Fallbacks: no such flight has started within a few animation frames (the
 * scene starts it in its first frame after the route change), the flight
 * stopped reporting progress, or a hard cap. Opens at once when there is no
 * 3D scene (no WebGL, simple mode) or the tab is hidden.
 *
 * Reads the store through a plain subscription: the scene may publish
 * `flight` every frame, and this never re-renders React.
 */
function createFlightGate(config: RevealGateConfig): EnterGate {
  return (start) => {
    // Simple (2D) mode (D94) has no flights to wait for, even while the canvas
    // is still being torn down.
    if (
      document.visibilityState === 'hidden' ||
      useSceneStore.getState().simpleMode === true ||
      !sceneCanvasPresent()
    ) {
      start('no-scene');
      return () => {};
    }

    let state = initialHeroGate;
    let open = true;
    let unsubscribe: () => void = () => {};
    let frameRequest = 0;
    let stallTimer = 0;
    let capTimer = 0;
    const mountedAt = performance.now();

    const release = () => {
      if (!open) return;
      open = false;
      unsubscribe();
      window.cancelAnimationFrame(frameRequest);
      window.clearTimeout(stallTimer);
      window.clearTimeout(capTimer);
    };
    const apply = (event: HeroGateEvent) => {
      if (!open) return;
      state = revealGateStep(state, event, config);
      if (state.revealed) {
        const reason = state.revealed;
        release();
        start(reason);
      }
    };
    const onFlight = (flight: FlightState) => {
      apply({ type: 'flight', flight });
      if (open && isGateFlight(flight, config)) {
        window.clearTimeout(stallTimer);
        stallTimer = window.setTimeout(() => apply({ type: 'stall' }), UI_MOTION.flightStallMs);
      }
    };

    // Grace period, counted in animation frames (see UI_MOTION).
    let frames = 0;
    const countFrame = () => {
      frames += 1;
      const elapsed = performance.now() - mountedAt;
      if (
        frames >= UI_MOTION.flightStartGraceFrames &&
        elapsed >= UI_MOTION.flightStartGraceMinMs
      ) {
        apply({ type: 'grace' });
        return;
      }
      if (open) frameRequest = window.requestAnimationFrame(countFrame);
    };

    unsubscribe = useSceneStore.subscribe((next, previous) => {
      if (next.flight !== previous.flight) onFlight(next.flight);
    });
    capTimer = window.setTimeout(() => apply({ type: 'timeout' }), UI_MOTION.heroRevealMaxWaitMs);
    frameRequest = window.requestAnimationFrame(countFrame);
    onFlight(useSceneStore.getState().flight);

    return release;
  };
}

/** The home hero (D44): the flight back to the universe at 0.6. */
export const universeFlightGate: EnterGate = createFlightGate(UNIVERSE_GATE);

/** A content panel (V2-06): the flight to its own route at 0.35. */
export function routeFlightGate(pathname: string): EnterGate {
  return createFlightGate(routeGate(pathname));
}
