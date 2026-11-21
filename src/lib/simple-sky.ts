import type { StarTileOptions } from './starfield';

/**
 * Static backdrop of simple (2D) mode (D94, fixes visual V2-05: the
 * no-WebGL home had an empty top half): two seeded star tiles (files in
 * `public/sky/`, generated from these options and verified by a unit test)
 * and a flat constellation of the universe nodes in their category colours,
 * projected from the same layout the 3D scene uses.
 */

/** Star tiles of the simple-mode sky (same density as the 404 sky). */
export const SIMPLE_SKY_TILES: readonly (StarTileOptions & { file: string })[] = [
  {
    file: '/sky/stars-near.svg',
    size: 1201,
    count: 150,
    seed: 2026,
    radius: [0.45, 0.85],
    opacity: [0.3, 0.8],
  },
  {
    file: '/sky/stars-far.svg',
    size: 1597,
    count: 36,
    seed: 20261,
    radius: [0.8, 1.2],
    opacity: [0.5, 0.9],
  },
];

export type Vec3 = readonly [number, number, number];

export interface ConstellationInput {
  categories: readonly { id: string; color: string; position: Vec3 }[];
  portfolio: { color: string; position: Vec3 };
  configurator: { color: string; position: Vec3 };
}

export type ConstellationKind = 'category' | 'portfolio' | 'configurator';

export interface ConstellationNode {
  id: string;
  kind: ConstellationKind;
  color: string;
  x: number;
  y: number;
  /** Core radius in viewBox units (bigger when nearer to the viewer). */
  r: number;
}

export interface Constellation {
  width: number;
  height: number;
  nodes: ConstellationNode[];
  /** Index pairs into `nodes`. */
  links: [number, number][];
}

/** Camera tilt (looking slightly down at the ring) and perspective distance. */
const TILT = (14 * Math.PI) / 180;
const DISTANCE = 42;
const WIDTH = 1000;
const PADDING = 60;
const BASE_RADIUS = 7;

function project([x, y, z]: Vec3) {
  const up = y * Math.cos(TILT) - z * Math.sin(TILT);
  const depth = z * Math.cos(TILT) + y * Math.sin(TILT);
  const scale = DISTANCE / (DISTANCE - depth);
  return { x: x * scale, y: -up * scale, scale };
}

const round = (value: number) => Math.round(value * 10) / 10;

/** The `count` nearest other nodes of node `index` (by projected distance). */
function nearest(points: readonly { x: number; y: number }[], index: number, among: number[]) {
  const from = points[index]!;
  return among
    .filter((other) => other !== index)
    .sort((a, b) => {
      const da = Math.hypot(points[a]!.x - from.x, points[a]!.y - from.y);
      const db = Math.hypot(points[b]!.x - from.x, points[b]!.y - from.y);
      return da - db;
    });
}

/**
 * Projects the universe nodes into a 1000-unit-wide viewBox (height follows
 * the layout's aspect). Links: the category ring in content order, and the
 * portfolio and configurator each tied to their two nearest categories —
 * the same idea as the scene's network, simplified. Pure and deterministic.
 */
export function buildConstellation(input: ConstellationInput): Constellation {
  const entries: { id: string; kind: ConstellationKind; color: string; position: Vec3 }[] = [
    ...input.categories.map((category) => ({ ...category, kind: 'category' as const })),
    { id: 'portfolio', kind: 'portfolio', ...input.portfolio },
    { id: 'configurator', kind: 'configurator', ...input.configurator },
  ];
  const projected = entries.map((entry) => project(entry.position));
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(Math.max(...xs) - minX, 1);
  const spanY = Math.max(Math.max(...ys) - minY, 1);
  const unit = (WIDTH - PADDING * 2) / spanX;
  const height = Math.round(spanY * unit + PADDING * 2);

  const nodes = entries.map((entry, index): ConstellationNode => {
    const point = projected[index]!;
    return {
      id: entry.id,
      kind: entry.kind,
      color: entry.color,
      x: round(PADDING + (point.x - minX) * unit),
      y: round(PADDING + (point.y - minY) * unit),
      r: round(BASE_RADIUS * point.scale),
    };
  });

  const categoryIndexes = input.categories.map((_, index) => index);
  const links: [number, number][] = [];
  const seen = new Set<string>();
  const link = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    links.push([a, b]);
  };
  if (categoryIndexes.length > 1) {
    for (const index of categoryIndexes) link(index, (index + 1) % categoryIndexes.length);
  }
  for (const index of [entries.length - 2, entries.length - 1]) {
    for (const other of nearest(nodes, index, categoryIndexes).slice(0, 2)) link(index, other);
  }

  return { width: WIDTH, height, nodes, links };
}
