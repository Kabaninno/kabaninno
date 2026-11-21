import type { RefObject } from 'react';
import { Vector3 } from 'three';
import { MAX_UNIVERSE_NODES } from '../config';

/**
 * Per-frame mutable state of the universe, written once per frame by
 * `Universe` (useFrame priority -0.5: after CameraControls has moved the
 * camera, before the node components) and read by nodes, links, labels and
 * hit zones. Arrays are sized MAX_UNIVERSE_NODES so they can be bound
 * directly as shader uniform arrays without copying.
 */
export interface UniverseRuntime {
  /** Drift offset per node (world units). */
  offsets: Vector3[];
  /** Eased hover/highlight per node, 0..1. */
  hover: number[];
  /** Camera focus per node, 0..1 (flight-driven while flying, eased otherwise). */
  focus: number[];
  /** Combined emphasis per node (what shaders display), 0..1. */
  emphasis: number[];
  /**
   * Steady "selected" state per node (configurator route, store `emphasis`,
   * D81), eased 0..1 (`selectProgress` is its linear clock).
   */
  selected: number[];
  selectProgress: number[];
  /** Core world radius after the minimum on-screen size rule. */
  coreRadius: number[];
  /** On-screen core diameter, CSS px. */
  corePx: number[];
  /** CSS px per world unit at the node's depth. */
  pxPerUnit: number[];
  /** Emissive boost for cores near their minimum size, 0..1. */
  small: number[];
  /**
   * 1 while the node is inside the free frame (or is the camera's focus),
   * fading to 0 when its projected centre leaves it: overlays never cover a
   * live node (visual V2-01, N2-02). Hit zones and labels follow it.
   */
  presence: number[];
  /** Projected node centre, CSS px (canvas space), and whether it is in front of the camera. */
  screenX: number[];
  screenY: number[];
  inFront: boolean[];
  /** Current accent of nodes whose colour animates (the beacon), CSS colour or null. */
  liveAccent: Array<string | null>;
  /** Eased visibility of the network (links, minor nodes), 0..1. */
  network: number;
  /** Animation time (frozen under prefers-reduced-motion). */
  time: number;
  /** Whether ambient motion (pulses, drift) runs. */
  animated: boolean;
}

/**
 * Children receive the ref (never `.current` during render) and read it inside
 * `useFrame`. `Universe` creates the runtime lazily in its own frame callback,
 * which runs before every child callback.
 */
export type UniverseRuntimeRef = RefObject<UniverseRuntime | null>;

export function createUniverseRuntime(): UniverseRuntime {
  const filled = (value: number) => new Array<number>(MAX_UNIVERSE_NODES).fill(value);
  return {
    offsets: Array.from({ length: MAX_UNIVERSE_NODES }, () => new Vector3()),
    hover: filled(0),
    focus: filled(0),
    emphasis: filled(0),
    selected: filled(0),
    selectProgress: filled(0),
    coreRadius: filled(0.3),
    corePx: filled(20),
    pxPerUnit: filled(20),
    small: filled(0),
    presence: filled(1),
    screenX: filled(0),
    screenY: filled(0),
    inFront: new Array<boolean>(MAX_UNIVERSE_NODES).fill(false),
    liveAccent: new Array<string | null>(MAX_UNIVERSE_NODES).fill(null),
    network: 1,
    time: 0,
    animated: true,
  };
}

/** Network visibility while the camera is focused on a node (art direction: "the network fades"). */
export const FOCUSED_NETWORK = 0.18;

/**
 * Brightness factor for a main node while the camera focuses another one:
 * neighbours dim with the network (down to `floor`); the focused node and
 * selected nodes (configurator emphasis) do not.
 */
export function neighbourDim(rt: UniverseRuntime, index: number, floor = 0.35): number {
  const visible = Math.min(Math.max((rt.network - FOCUSED_NETWORK) / (1 - FOCUSED_NETWORK), 0), 1);
  const dim = floor + (1 - floor) * visible;
  const lift = Math.max(rt.focus[index] ?? 0, rt.selected[index] ?? 0);
  return dim + (1 - dim) * lift;
}

/** Duration of the selected-state transition (configurator emphasis), seconds. */
export const SELECT_SECONDS = 0.3;
/** Emphasis a selected node displays (hover = 1 stays on top). */
export const SELECTED_EMPHASIS = 0.6;

/**
 * Advances the linear clock of a node's selected state toward `target`
 * (0 or 1) so a full transition takes SELECT_SECONDS; `instant` (reduced
 * motion) jumps straight to it.
 */
export function stepSelection(progress: number, target: number, dt: number, instant: boolean) {
  if (instant) return target;
  const step = dt / SELECT_SECONDS;
  return target > progress ? Math.min(progress + step, target) : Math.max(progress - step, target);
}

/** Displayed selected amount for a linear progress: ease in-out (smoothstep). */
export function easeSelection(progress: number): number {
  const t = Math.min(Math.max(progress, 0), 1);
  return t * t * (3 - 2 * t);
}

/** Ambient drift amplitude of nodes, world units. */
export const DRIFT_AMPLITUDE = 0.24;

/** Deterministic, slow, non-periodic-looking drift for node `index`. */
export function writeDrift(out: Vector3, index: number, time: number, amplitude: number): void {
  out.set(
    Math.sin(time * 0.11 + index * 1.7) * amplitude,
    Math.sin(time * 0.083 + index * 2.9) * amplitude * 0.6,
    Math.cos(time * 0.097 + index * 0.7) * amplitude,
  );
}
