import type { CategoryDna } from '~/content/schema';

export type CoreStyle = CategoryDna['core'];

/**
 * Registry: DNA `core` value → surface parameters of the detailed system-view
 * core (node-core.ts, DETAIL variant). One program serves every style, so the
 * prewarm compiles it once. M3 may replace entries with dedicated shaders;
 * a new `core` enum value only needs an entry here (TypeScript enforces it).
 */
export interface CoreStyleParams {
  /** flow scale, flow speed, ridge scale, ridge sharpness */
  a: readonly [number, number, number, number];
  /** strata bands, forge crust, iridescence, comet stream (0..1 each) */
  b: readonly [number, number, number, number];
  /** Prism facets, 0..1. */
  facet: number;
}

export const CORE_STYLES: Record<CoreStyle, CoreStyleParams> = {
  prism: { a: [2.6, 0.12, 4.2, 9], b: [0, 0, 0.15, 0], facet: 0.85 },
  strata: { a: [2.0, 0.16, 3.0, 6], b: [1, 0, 0, 0], facet: 0 },
  forge: { a: [1.6, 0.1, 2.6, 5], b: [0, 0.85, 0, 0], facet: 0 },
  neural: { a: [2.8, 0.22, 3.6, 7], b: [0, 0, 1, 0], facet: 0 },
  comet: { a: [2.4, 0.3, 3.8, 8], b: [0, 0, 0, 1], facet: 0 },
};
