import {
  CylinderGeometry,
  OctahedronGeometry,
  TorusKnotGeometry,
  type BufferGeometry,
} from 'three';
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

/** Flat shading: crisp facets that catch the light (V5-04). */
function faceted(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}

/** CRM: three hexagonal data slabs with clear gaps (a database stack, not a cake). */
function strata(): BufferGeometry {
  const slabs = [-0.5, 0, 0.5].map((y, i) => {
    const radius = 0.9 - i * 0.14;
    const slab = new CylinderGeometry(radius, radius, 0.2, 6, 1);
    slab.translate(0, y, 0);
    return slab;
  });
  const merged = mergeGeometries(slabs);
  for (const slab of slabs) slab.dispose();
  return faceted(merged);
}

/** AI: a thin, clearly readable neural knot (a thick knot read as a lump). */
function neuralKnot(detail: number): BufferGeometry {
  const knot = new TorusKnotGeometry(0.62, 0.11, 96 + detail * 48, 8 + detail * 2, 2, 3);
  knot.computeBoundingSphere();
  const scale = 1 / (knot.boundingSphere?.radius ?? 1);
  knot.scale(scale, scale, scale);
  return knot;
}

export const EMBLEMS: Record<EmblemKey, EmblemEntry> = {
  prism: {
    create: (detail) => PLANET_SHAPES.crystal.create(detail, 0),
    spin: 0.45,
    tilt: [0, 0, 0],
  },
  strata: { create: strata, spin: 0.3, tilt: [0.38, 0, 0] },
  forge: { create: (detail) => PLANET_SHAPES.gear.create(detail, 0), spin: 0.5, tilt: [0.2, 0, 0] },
  neural: {
    create: neuralKnot,
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
