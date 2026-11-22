import type { RefObject } from 'react';
import { createGyroInput, type GyroInput } from './camera/gyro';

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
  /**
   * Category whose system view accepts planet input (system/planet route,
   * camera settled, universe revealed), else null.
   */
  systemInteractive: string | null;
  /** Live orbit angle per planet ("category/slug"): the camera frames the focused one. */
  planetAngles: Map<string, number>;
  /** Projected planets of the mounted system ("category/slug"), for labels and hit zones. */
  planetTargets: Map<string, PlanetTarget>;
  /**
   * The portfolio archive accepts card input (portfolio / project route,
   * camera settled, universe revealed).
   */
  archiveInteractive: boolean;
  /** Projected project card-objects of the mounted archive (by slug), for labels. */
  projectTargets: Map<string, PlanetTarget>;
  /**
   * Focused content that is compiled and on screen (`system:<category>`,
   * `archive`): with the settled camera it drives `html[data-scene-ready]`.
   */
  readyContent: Set<string>;
  /** Text box of the visible canvas label, device px, GL origin (bottom-left), or null. */
  labelRect: [number, number, number, number] | null;
  /**
   * Measured text block of each category's canvas label (CSS px, by node key),
   * published by NodeLabels; `labelSizesVersion` grows on every re-measure
   * (web fonts loaded). The configurator framing reserves room for them.
   */
  labelSizes: Map<string, { width: number; height: number }>;
  labelSizesVersion: number;
  /**
   * Configurator view with connections: the side each selected category's
   * label was framed for (by node key), published by the camera director;
   * empty otherwise. NodeLabels tries that placement first.
   */
  selectionLabels: Map<string, { side: 1 | -1; rise: 1 | -1 }>;
  /**
   * A universe node that keeps full presence while the camera is close to it
   * even though it fills the free frame (the intro starts inside the first
   * category's system, B1); null otherwise.
   */
  presenceKey: string | null;
  /** Device tilt from `deviceorientation` (phones only, see GyroParallax); `live` once real readings arrive. */
  gyro: GyroInput;
}

/** A planet (or an archive card) as the labels see it (CSS px, canvas space). */
export interface PlanetTarget {
  x: number;
  y: number;
  /** On-screen radius of the planet body. */
  radiusPx: number;
  /** CSS px per world unit at the planet's depth. */
  pxPerUnit: number;
  inFront: boolean;
  /** Materialized (system detail) — hidden while the dive is still far. */
  visible: boolean;
  label: string;
  /** Optional second line (archive cards: their categories). */
  sub?: string | null;
  color: string;
  ordinal: number;
  total: number;
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
    systemInteractive: null,
    planetAngles: new Map(),
    planetTargets: new Map(),
    archiveInteractive: false,
    projectTargets: new Map(),
    readyContent: new Set(),
    labelRect: null,
    labelSizes: new Map(),
    labelSizesVersion: 0,
    selectionLabels: new Map(),
    presenceKey: null,
    gyro: createGyroInput(),
  };
}

/** `bus.readyContent` key of a category's system content. */
export function systemReadyKey(categoryId: string): string {
  return `system:${categoryId}`;
}

/** `bus.readyContent` key of the portfolio archive. */
export const ARCHIVE_READY_KEY = 'archive';

/** Demand mode: keep the render loop alive for at least `ms` from now. */
export function keepAlive(bus: SceneBus, ms: number): void {
  const until = performance.now() + ms;
  if (until > bus.busyUntil) bus.busyUntil = until;
}
