import type { RefObject } from 'react';
import { Vector3 } from 'three';
import { MAX_UNIVERSE_NODES } from '../config';

/**
 * Per-frame mutable state of the universe, written once per frame by
 * `Universe` (useFrame priority -1, before the node components) and read by
 * nodes and links. Arrays are sized MAX_UNIVERSE_NODES so they can be bound
 * directly as shader uniform arrays without copying.
 */
export interface UniverseRuntime {
  /** Drift offset per node (world units). */
  offsets: Vector3[];
  /** Eased hover/highlight per node, 0..1. */
  hover: number[];
  /** Eased camera focus per node, 0..1. */
  focus: number[];
  /** Combined emphasis per node (what shaders display), 0..1. */
  emphasis: number[];
  /** Eased visibility of the network (links), 0..1. */
  network: number;
  /** Animation time (frozen under prefers-reduced-motion). */
  time: number;
  /** Whether ambient motion (pulses, drift) runs. */
  animated: boolean;
}

/**
 * Children receive the ref (never `.current` during render) and read it inside
 * `useFrame`. `Universe` creates the runtime lazily in its own frame callback,
 * which runs before every child callback (priority -1).
 */
export type UniverseRuntimeRef = RefObject<UniverseRuntime | null>;

export function createUniverseRuntime(): UniverseRuntime {
  return {
    offsets: Array.from({ length: MAX_UNIVERSE_NODES }, () => new Vector3()),
    hover: new Array<number>(MAX_UNIVERSE_NODES).fill(0),
    focus: new Array<number>(MAX_UNIVERSE_NODES).fill(0),
    emphasis: new Array<number>(MAX_UNIVERSE_NODES).fill(0),
    network: 1,
    time: 0,
    animated: true,
  };
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
