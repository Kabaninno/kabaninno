import { universeKeyForHighlight } from '@/scene/node-ids';
import type { Constellation } from './simple-sky';

/**
 * The interactive 2D maps of simple mode (D124): the universe (5 systems,
 * portfolio, configurator) and each system (its core and planets). Pure
 * layout and highlight mapping; the server fills in labels and paths
 * (`simple-map-data.ts`), `SimpleMap.tsx` renders them. Coordinates are in
 * viewBox units (1000 wide); the renderer places links at percentages of the
 * same box, so SVG lines and HTML links line up.
 */

export type MapNodeKind = 'category' | 'portfolio' | 'configurator' | 'core' | 'planet';

export interface MapNode {
  /** Highlight id shared with the HTML lists (`sceneNodeId`). */
  key: string;
  kind: MapNodeKind;
  label: string;
  color: string;
  /** Locale-less path the node links to. */
  path: string;
  x: number;
  y: number;
  /** Visual radius in viewBox units (the link's hit area is at least 44 px). */
  r: number;
}

export interface MapView {
  width: number;
  height: number;
  nodes: MapNode[];
  /** Lines between nodes (indexes into `nodes`). */
  links: [number, number][];
  /** Orbit ellipses around `center` (system maps). */
  orbits: { rx: number; ry: number }[];
  center: { x: number; y: number } | null;
  /** Rare light impulses travelling from the first to the second node. */
  impulses: [number, number][];
}

/** At most this many impulses per map (they are rare and light). */
export const MAX_IMPULSES = 4;

const round = (value: number) => Math.round(value * 10) / 10;

/** Universe map from the constellation (same layout as the 3D network). */
export function universeMapFrom(
  sky: Constellation,
  describe: (id: string, kind: MapNodeKind) => { key: string; label: string; path: string },
): MapView {
  const nodes = sky.nodes.map((node): MapNode => {
    const kind: MapNodeKind = node.kind;
    return { ...describe(node.id, kind), kind, color: node.color, x: node.x, y: node.y, r: node.r };
  });
  return {
    width: sky.width,
    height: sky.height,
    nodes,
    links: sky.links,
    orbits: [],
    center: null,
    impulses: sky.links.filter((_, index) => index % 2 === 0).slice(0, MAX_IMPULSES),
  };
}

export interface SystemMapInput {
  key: string;
  label: string;
  path: string;
  color: string;
  planets: {
    key: string;
    label: string;
    path: string;
    color: string;
    /** Orbit radius and phase (0..1) from the planet DNA. */
    orbit: { radius: number; phase: number };
  }[];
}

const SYSTEM_WIDTH = 1000;
/** Vertical squash of the orbits (a tilted view of the system). */
const ORBIT_SQUASH = 0.42;
const SYSTEM_PADDING = 80;
const CORE_RADIUS = 26;
const PLANET_RADIUS = 11;

/**
 * A system seen from slightly above: the core in the centre, one ellipse per
 * planet orbit (radius ∝ orbit radius, the outermost fills the width), each
 * planet at its orbit phase. Lines: none; impulses run from the core to the
 * planets.
 */
export function buildSystemMap(input: SystemMapInput): MapView {
  const maxRadius = Math.max(...input.planets.map((planet) => planet.orbit.radius), 1);
  const scale = (SYSTEM_WIDTH / 2 - SYSTEM_PADDING) / maxRadius;
  const height = Math.round(2 * maxRadius * scale * ORBIT_SQUASH + 2 * SYSTEM_PADDING);
  const center = { x: SYSTEM_WIDTH / 2, y: height / 2 };

  const core: MapNode = {
    key: input.key,
    kind: 'core',
    label: input.label,
    path: input.path,
    color: input.color,
    x: center.x,
    y: center.y,
    r: CORE_RADIUS,
  };
  const planets = input.planets.map((planet): MapNode => {
    const rx = planet.orbit.radius * scale;
    const angle = planet.orbit.phase * Math.PI * 2;
    return {
      key: planet.key,
      kind: 'planet',
      label: planet.label,
      path: planet.path,
      color: planet.color,
      x: round(center.x + Math.cos(angle) * rx),
      y: round(center.y + Math.sin(angle) * rx * ORBIT_SQUASH),
      r: PLANET_RADIUS,
    };
  });
  return {
    width: SYSTEM_WIDTH,
    height,
    nodes: [core, ...planets],
    links: [],
    orbits: input.planets.map((planet) => ({
      rx: round(planet.orbit.radius * scale),
      ry: round(planet.orbit.radius * scale * ORBIT_SQUASH),
    })),
    center,
    impulses: planets.slice(0, MAX_IMPULSES).map((_, index): [number, number] => [0, index + 1]),
  };
}

/**
 * Index of the node a highlight id lights on this map, or -1. On the
 * universe map a service lights its system and a case the portfolio
 * (`universeKeyForHighlight`); on a system map ids match directly.
 */
export function litNodeIndex(view: MapView, highlighted: string | null): number {
  if (!highlighted) return -1;
  const direct = view.nodes.findIndex((node) => node.key === highlighted);
  if (direct !== -1) return direct;
  const universeKey = universeKeyForHighlight(highlighted);
  return view.nodes.findIndex((node) => node.key === universeKey);
}

/** Lines touching a node (indexes into `links`). */
export function linesOf(view: MapView, nodeIndex: number): number[] {
  if (nodeIndex < 0) return [];
  return view.links.flatMap(([a, b], index) => (a === nodeIndex || b === nodeIndex ? [index] : []));
}

/** A position in the map box as percentages (for the HTML links). */
export function percentOf(view: MapView, x: number, y: number): { left: string; top: string } {
  return {
    left: `${round((x / view.width) * 100)}%`,
    top: `${round((y / view.height) * 100)}%`,
  };
}
