import type { Vec3 } from './types';

/** Radius of the ring on which category nodes are placed. */
export const UNIVERSE_RADIUS = 14;

/** Fixed anchors for the non-category nodes. */
export const PORTFOLIO_POSITION: Vec3 = [-9, 7, -26];
export const CONFIGURATOR_POSITION: Vec3 = [10, -5.5, -6];

/**
 * Auto-layout for category nodes: an elliptical, slightly undulating ring
 * around the origin. Deterministic, so adding a category only reflows the ring.
 * A category can override its position via `dna.universePosition`.
 */
export function layoutCategoryNodes(
  count: number,
  overrides: ReadonlyArray<Vec3 | undefined> = [],
  radius: number = UNIVERSE_RADIUS,
): Vec3[] {
  return Array.from({ length: count }, (_, index) => {
    const override = overrides[index];
    if (override) return override;
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.55;
    const y = Math.sin(index * 2.399) * 2.6;
    return [round(x), round(y), round(z)];
  });
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
