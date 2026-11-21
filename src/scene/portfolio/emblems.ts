import { CylinderGeometry, OctahedronGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CategoryDna } from '~/content/schema';
import { PLANET_SHAPES } from '../system/planet-geometry';

export type EmblemKey = CategoryDna['core'];

/**
 * Registry: the main category's core style → the emblem floating on a
 * project card, echoing that category's visual language (web's cut crystal,
 * CRM's data strata, automation's gear, AI's neural knot, Telegram's paper
 * plane). Geometries are about unit radius; the card scales them. A new core
 * style needs an entry here (TypeScript enforces it).
 */
export interface EmblemEntry {
  create(detail: number): BufferGeometry;
  /** Spin around the emblem's own Y axis, rad/s. */
  spin: number;
  /** Base orientation (Euler XYZ, radians) before the spin. */
  tilt: readonly [number, number, number];
}

function strata(detail: number): BufferGeometry {
  const segments = 20 + detail * 12;
  const discs = [-0.42, 0, 0.42].map((y, i) => {
    const radius = 0.95 - i * 0.18;
    const disc = new CylinderGeometry(radius, radius, 0.2, segments, 1);
    disc.translate(0, y, 0);
    return disc;
  });
  const merged = mergeGeometries(discs);
  for (const disc of discs) disc.dispose();
  return merged;
}

export const EMBLEMS: Record<EmblemKey, EmblemEntry> = {
  prism: {
    create: (detail) => PLANET_SHAPES.crystal.create(detail, 0),
    spin: 0.45,
    tilt: [0, 0, 0],
  },
  strata: { create: strata, spin: 0.3, tilt: [0.32, 0, 0] },
  forge: { create: (detail) => PLANET_SHAPES.gear.create(detail, 0), spin: 0.5, tilt: [0.2, 0, 0] },
  neural: {
    create: (detail) => PLANET_SHAPES['torus-knot'].create(detail, 0),
    spin: 0.35,
    tilt: [0.4, 0, 0],
  },
  comet: {
    create: (detail) => PLANET_SHAPES.dart.create(detail, 0),
    spin: 0.4,
    tilt: [0.25, 0, 0.3],
  },
};

/** Emblem of a project whose main category is unknown to the scene. */
export const FALLBACK_EMBLEM: EmblemEntry = {
  create: () => new OctahedronGeometry(1, 0),
  spin: 0.4,
  tilt: [0, 0, 0],
};

export function emblemFor(key: EmblemKey | null): EmblemEntry {
  return key ? EMBLEMS[key] : FALLBACK_EMBLEM;
}
