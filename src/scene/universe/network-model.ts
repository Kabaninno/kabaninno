import { createRandom } from '../random';
import type { Vec3 } from '../types';
import type { UniverseModel, UniverseNode } from './model';

/**
 * The "neural" fabric around the 7 main nodes (art direction: the universe
 * is the studio's neural network): many minor glowing nodes joined by thin
 * links, dendrites feeding every main node, and bridges along the main links.
 * Pure and deterministic: positions derive from the universe model (so new
 * categories reshape the fabric) and a seeded PRNG (identical on every visit).
 */
export interface MinorNode {
  position: Vec3;
  /** Sprite size, world units. */
  size: number;
  /** Base brightness, 0..1. */
  brightness: number;
  /** Drift / twinkle phases, 0..1 each. */
  phase: Vec3;
  /** Index (in `model.nodes`) of the closest main node: the tint source. */
  anchor: number;
  /** How much of the anchor's color the node takes, 0..1. */
  tint: number;
}

export type LinkEnd = { kind: 'main'; index: number } | { kind: 'minor'; index: number };

export type NetworkLinkKind = 'main' | 'dendrite' | 'minor';

export interface NetworkLink {
  a: LinkEnd;
  b: LinkEnd;
  kind: NetworkLinkKind;
  /** Deterministic 0..1 value that desynchronizes pulses. */
  seed: number;
}

export interface NetworkModel {
  minor: MinorNode[];
  links: NetworkLink[];
}

/** Size of the deterministic minor-node set; quality tiers render a prefix. */
export const MAX_MINOR_NODES = 160;

/** Keeps minor nodes off a main node's core, halo and orbit preview. */
export function clearRadius(node: UniverseNode): number {
  switch (node.kind) {
    case 'category':
      return Math.max(node.systemRadius * 1.6, 1.6);
    case 'portfolio':
      return 3.6;
    case 'configurator':
      return 2.2;
  }
}

const MIN_SPACING = 0.85;
const DENDRITES = { category: 4, anchor: 3, maxLength: 7.5 } as const;
const MINOR_LINKS = { perNode: 1, maxDegree: 3, maxLength: 4.2 } as const;

export function generateMinorNodes(model: UniverseModel): MinorNode[] {
  const mains = model.nodes;
  if (mains.length === 0) return [];
  const random = createRandom(seedFor(model));
  const clears = mains.map(clearRadius);
  const weights = mains.map((node) => (node.kind === 'category' ? 1 : 0.55));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const nodes: MinorNode[] = [];

  const pickMain = (): number => {
    let pick = random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i]!;
      if (pick <= 0) return i;
    }
    return weights.length - 1;
  };

  const candidate = (): Vec3 => {
    const roll = random();
    if (roll < 0.5 || model.links.length === 0) {
      // Dendrite cluster around a main node.
      const m = pickMain();
      const dir = randomDirection(random, 0.55);
      const r = clears[m]! + 0.4 + Math.pow(random(), 1.3) * 3.8;
      return add(mains[m]!.position, scale(dir, r));
    }
    if (roll < 0.85) {
      // Bridge node scattered along a main link.
      const link = model.links[Math.floor(random() * model.links.length)]!;
      const t = 0.15 + random() * 0.7;
      const base = lerp3(mains[link.a]!.position, mains[link.b]!.position, t);
      const spread = (random() + random() + random() - 1.5) * 1.6;
      const dir = randomDirection(random, 0.7);
      return add(base, scale(dir, Math.abs(spread) + 0.3));
    }
    // Sparse far field around the ring, for depth.
    const angle = random() * Math.PI * 2;
    const radius = 15 + random() * 7;
    return [
      Math.cos(angle) * radius,
      (random() - 0.5) * 8,
      Math.sin(angle) * radius * 0.65 - 3 * random(),
    ];
  };

  for (let i = 0; i < MAX_MINOR_NODES; i++) {
    let position = candidate();
    for (let attempt = 0; attempt < 10; attempt++) {
      const clearOfMains = mains.every(
        (main, m) => distance(position, main.position) >= clears[m]!,
      );
      const spaced = nodes.every((node) => distance(position, node.position) >= MIN_SPACING);
      if (clearOfMains && spaced) break;
      position = candidate();
    }
    // Last resort: push the node out of any main node's clear sphere.
    mains.forEach((main, m) => {
      const d = distance(position, main.position);
      if (d < clears[m]!) {
        const dir = d > 1e-6 ? scale(sub(position, main.position), 1 / d) : ([0, 1, 0] as Vec3);
        position = add(main.position, scale(dir, clears[m]! + 0.2));
      }
    });

    let anchor = 0;
    let anchorDistance = Infinity;
    mains.forEach((main, m) => {
      const d = distance(position, main.position) - clears[m]!;
      if (d < anchorDistance) {
        anchorDistance = d;
        anchor = m;
      }
    });
    const hub = random() < 0.08;
    nodes.push({
      position: position.map(round) as Vec3,
      size: hub ? 0.22 + random() * 0.06 : 0.08 + Math.pow(random(), 2.2) * 0.13,
      brightness: hub ? 1 : 0.45 + Math.pow(random(), 1.5) * 0.5,
      phase: [random(), random(), random()],
      anchor,
      tint: clamp(1 - anchorDistance / 7, 0.15, 0.8),
    });
  }
  return nodes;
}

/** Minor nodes (prefix of the deterministic set) plus every network link. */
export function buildNetwork(model: UniverseModel, minorCount: number): NetworkModel {
  const minor = generateMinorNodes(model).slice(0, Math.max(0, minorCount));
  const random = createRandom(seedFor(model) ^ 0x9e3779b9);
  const links: NetworkLink[] = [];
  const pairKeys = new Set<string>();
  const degree = new Array<number>(minor.length).fill(0);

  const push = (a: LinkEnd, b: LinkEnd, kind: NetworkLinkKind) => {
    const key = [endKey(a), endKey(b)].sort().join('|');
    if (pairKeys.has(key)) return false;
    pairKeys.add(key);
    links.push({ a, b, kind, seed: random() });
    return true;
  };

  for (const link of model.links) {
    push({ kind: 'main', index: link.a }, { kind: 'main', index: link.b }, 'main');
  }

  // Dendrites: data flows from the nearest minor nodes into every main node.
  model.nodes.forEach((main, m) => {
    const count = main.kind === 'category' ? DENDRITES.category : DENDRITES.anchor;
    nearest(minor, main.position, count, DENDRITES.maxLength).forEach((i) => {
      if (push({ kind: 'minor', index: i }, { kind: 'main', index: m }, 'dendrite')) {
        degree[i]! += 1;
      }
    });
  });

  // Sparse minor ↔ minor web.
  minor.forEach((node, i) => {
    let added = 0;
    for (const j of nearest(minor, node.position, 8, MINOR_LINKS.maxLength)) {
      if (added >= MINOR_LINKS.perNode || degree[i]! >= MINOR_LINKS.maxDegree) break;
      if (j === i || degree[j]! >= MINOR_LINKS.maxDegree) continue;
      if (push({ kind: 'minor', index: i }, { kind: 'minor', index: j }, 'minor')) {
        degree[i]! += 1;
        degree[j]! += 1;
        added += 1;
      }
    }
  });

  return { minor, links };
}

/** Deterministic seed from the model's node keys (content-driven). */
function seedFor(model: UniverseModel): number {
  let hash = 0x811c9dc5;
  for (const node of model.nodes) {
    for (let i = 0; i < node.key.length; i++) {
      hash ^= node.key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

/** Indices of up to `count` minor nodes closest to `point` within `maxDistance`. */
function nearest(nodes: readonly MinorNode[], point: Vec3, count: number, maxDistance: number) {
  return nodes
    .map((node, index) => ({ index, d: distance(node.position, point) }))
    .filter((entry) => entry.d > 1e-6 && entry.d <= maxDistance)
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((entry) => entry.index);
}

function endKey(end: LinkEnd): string {
  return `${end.kind}:${end.index}`;
}

function randomDirection(random: () => number, squashY: number): Vec3 {
  const cosTheta = random() * 2 - 1;
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  const phi = random() * Math.PI * 2;
  return [Math.cos(phi) * sinTheta, cosTheta * squashY, Math.sin(phi) * sinTheta];
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(v: Vec3, factor: number): Vec3 {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
