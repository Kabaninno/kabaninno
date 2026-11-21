import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  OctahedronGeometry,
  Path,
  Shape,
  TorusGeometry,
  TorusKnotGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Planet } from '~/content/schema';
import { createRandom } from '../random';

export type PlanetShape = Planet['shape'];
export type MoonKind = NonNullable<Planet['moons']>['kind'];

/**
 * Registry: DNA `shape` → procedural geometry, about unit radius (the planet
 * group is scaled to the planet size). A new shape value only needs an
 * entry here (TypeScript enforces it).
 */
export interface ShapeEntry {
  /** `detail`: 0 (low tier) … 2 (high); `seed`: per planet. */
  create(detail: number, seed: number): BufferGeometry;
  /** Noise displacement in the vertex shader (DEFORM), unit radius. */
  deform: number;
  /** Open geometry (funnel): render both sides. */
  doubleSided: boolean;
  /** Spin axis speed (rad/s) around the planet's own Y and X. */
  spin: readonly [number, number];
  /** Largest extent relative to the unit sphere (camera framing, hit zones). */
  extent: number;
  /**
   * Radius of the visible body relative to the unit sphere, as seen on screen
   * (flat, thin or sparse shapes show less): drives the small-planet boost.
   */
  body: number;
  /**
   * Hard-edged (flat-shaded / extruded) geometry: its facet edges may glow.
   * Smooth shapes keep facet edges off — on a small curved body the normal
   * changes fast everywhere and the edge glow washed it white (MJ-F4-01).
   */
  faceted: boolean;
}

const flat = (geometry: BufferGeometry): BufferGeometry => {
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  if (result !== geometry) geometry.dispose();
  result.computeVertexNormals();
  return result;
};

/** Centres a geometry and scales it to the given bounding radius. */
const normalized = (geometry: BufferGeometry, radius = 1): BufferGeometry => {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    -(box.min.z + box.max.z) / 2,
  );
  geometry.computeBoundingSphere();
  const current = geometry.boundingSphere!.radius || 1;
  geometry.scale(radius / current, radius / current, radius / current);
  geometry.computeBoundingSphere();
  return geometry;
};

function gearShape(teeth: number): Shape {
  const shape = new Shape();
  const outer = 1;
  const root = 0.8;
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const phase = i % 4;
    const radius = phase === 1 || phase === 2 ? outer : root;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new Path();
  hole.absarc(0, 0, 0.36, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

export const PLANET_SHAPES: Record<PlanetShape, ShapeEntry> = {
  sphere: {
    create: (detail) => new IcosahedronGeometry(1, 6 + detail * 5),
    deform: 0,
    doubleSided: false,
    spin: [0.12, 0],
    extent: 1,
    body: 1,
    faceted: false,
  },
  blob: {
    create: (detail) => new IcosahedronGeometry(1, 6 + detail * 5),
    deform: 0.16,
    doubleSided: false,
    spin: [0.08, 0],
    extent: 1.15,
    body: 1,
    faceted: false,
  },
  torus: {
    create: (detail) =>
      normalized(new TorusGeometry(0.72, 0.28, 12 + detail * 6, 32 + detail * 24)),
    deform: 0,
    doubleSided: false,
    spin: [0.18, 0.11],
    extent: 1,
    body: 0.85,
    faceted: false,
  },
  'torus-knot': {
    create: (detail) =>
      normalized(new TorusKnotGeometry(0.62, 0.2, 80 + detail * 50, 8 + detail * 4, 2, 3)),
    deform: 0,
    doubleSided: false,
    spin: [0.22, 0.08],
    extent: 1,
    body: 0.85,
    faceted: false,
  },
  crystal: {
    create: () =>
      flat(
        normalized(
          new LatheGeometry([new Vector2(0, -1.45), new Vector2(0.62, 0), new Vector2(0, 1.45)], 7),
          1.45,
        ),
      ),
    deform: 0,
    doubleSided: false,
    spin: [0.35, 0],
    extent: 1.45,
    body: 0.7,
    faceted: true,
  },
  icosahedron: {
    create: () => flat(new IcosahedronGeometry(1, 0)),
    deform: 0,
    doubleSided: false,
    spin: [0.2, 0.07],
    extent: 1,
    body: 0.95,
    faceted: true,
  },
  octahedron: {
    create: () => flat(new OctahedronGeometry(1, 0)),
    deform: 0,
    doubleSided: false,
    spin: [0.3, 0],
    extent: 1,
    body: 0.8,
    faceted: true,
  },
  gear: {
    create: (detail) => {
      const geometry = new ExtrudeGeometry(gearShape(12), {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.04,
        bevelSegments: detail > 0 ? 2 : 1,
        curveSegments: 6 + detail * 4,
      });
      return normalized(geometry);
    },
    deform: 0,
    doubleSided: false,
    spin: [0, 0.45],
    extent: 1,
    body: 0.42,
    faceted: true,
  },
  funnel: {
    create: (detail) =>
      normalized(
        new LatheGeometry(
          [
            new Vector2(0.14, -0.95),
            new Vector2(0.19, -0.35),
            new Vector2(0.42, 0.05),
            new Vector2(0.86, 0.45),
            new Vector2(1.0, 0.72),
            new Vector2(0.97, 0.8),
          ],
          24 + detail * 16,
        ),
      ),
    deform: 0,
    doubleSided: true,
    spin: [0.25, 0],
    extent: 1,
    body: 0.75,
    faceted: false,
  },
  dart: {
    create: () => {
      const geometry = new ConeGeometry(0.5, 1.9, 3, 1);
      geometry.rotateZ(-Math.PI / 2);
      return flat(normalized(geometry, 1.4));
    },
    deform: 0,
    doubleSided: false,
    spin: [0, 0.6],
    extent: 1.4,
    body: 0.55,
    faceted: true,
  },
  'cube-cluster': {
    create: (_detail, seed) => {
      const random = createRandom(0xc0be + seed);
      const parts: BufferGeometry[] = [new BoxGeometry(0.7, 0.7, 0.7)];
      const offsets: Array<[number, number, number]> = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
      for (const [x, y, z] of offsets) {
        const size = 0.28 + random() * 0.22;
        const box = new BoxGeometry(size, size, size);
        const distance = 0.55 + random() * 0.25;
        box.translate(x * distance, y * distance, z * distance);
        parts.push(box);
      }
      const merged = mergeGeometries(parts.map((part) => part.toNonIndexed()));
      parts.forEach((part) => part.dispose());
      return flat(normalized(merged ?? new BoxGeometry(1, 1, 1)));
    },
    deform: 0,
    doubleSided: false,
    spin: [0.16, 0.12],
    extent: 1,
    body: 0.42,
    faceted: true,
  },
};

/** Moon geometry per kind (unit size; the instance matrices scale them). */
export const MOON_SHAPES: Record<MoonKind, () => BufferGeometry> = {
  // Faceted (MJ-F3-01): a cut crystal orb catches edges, a smooth sphere looked stock.
  orb: () => flat(new IcosahedronGeometry(1, 1)),
  cube: () => new BoxGeometry(1, 1, 1),
  conveyor: () => new BoxGeometry(1, 1, 1),
  shard: () => flat(new OctahedronGeometry(1, 0)),
};
