import type { RefObject } from 'react';

/**
 * Mutable per-frame state shared by the camera director, the universe, the
 * post-processing and the hit zones. Written only inside `useFrame` callbacks
 * and event handlers (never during render), read the same way, so none of it
 * triggers React renders. Three-free.
 */
export interface SceneBus {
  /** A programmatic camera flight or a reduced-motion cut is running. */
  flying: boolean;
  /** Universe nodes accept pointer input (overview, camera settled). */
  interactive: boolean;
  /**
   * Focus blending published by the director while a flight runs: the node
   * being left and the node being approached, each with an amount 0..1 that
   * follows the flight's dolly channel, so the dive (core growth, network
   * fade) is in lockstep with the camera. When `focusDriven` is false the
   * universe eases toward the URL focus on its own.
   */
  focusDriven: boolean;
  focusFrom: string | null;
  focusFromAmount: number;
  focusTo: string | null;
  focusToAmount: number;
  /** Bloom flash on arrival, 0..1. */
  flash: number;
  /** Minimum on-screen core diameter for the current framing, CSS px. */
  minCorePx: number;
  /** The pointer rests on a universe node (pauses the idle auto-rotate). */
  hovering: boolean;
  /** `performance.now()` of the last pointer/wheel/touch input on the canvas. */
  lastInputAt: number;
  /** frameloop="demand": keep rendering until this `performance.now()` time. */
  busyUntil: number;
}

export type SceneBusRef = RefObject<SceneBus>;

export function createSceneBus(): SceneBus {
  return {
    flying: false,
    interactive: false,
    focusDriven: false,
    focusFrom: null,
    focusFromAmount: 0,
    focusTo: null,
    focusToAmount: 0,
    flash: 0,
    minCorePx: 20,
    hovering: false,
    lastInputAt: 0,
    busyUntil: 0,
  };
}

/** Demand mode: keep the render loop alive for at least `ms` from now. */
export function keepAlive(bus: SceneBus, ms: number): void {
  const until = performance.now() + ms;
  if (until > bus.busyUntil) bus.busyUntil = until;
}
