import { Color } from 'three';
import type { UniverseModel } from './model';
import { bowControlPoint } from './network-model';

/**
 * Geometry of the configurator selection links (D81): one curved link from
 * every category node to the configurator beacon (the same bow as the main
 * network links, so a link that already exists simply lights up), plus the
 * impulse sprites that travel along it. Pure and data-driven: a new category
 * gets its link with no scene change. Which links show is decided per frame
 * on the GPU from the runtime's `selected` array.
 */

/** World distance between data packets on a link. */
export const PACKET_SPACING = 5;
/** Packet speed toward the beacon, world units per second. */
export const PACKET_SPEED = 2.4;

/** Packet pattern of a link of `length` world units: count and cycles per second. */
export function packetFlow(length: number): { packets: number; rate: number } {
  const packets = Math.max(2, Math.round(length / PACKET_SPACING));
  return { packets, rate: (PACKET_SPEED * packets) / Math.max(length, 1e-3) };
}

export interface SelectionGeometry {
  /** Line segments: two vertices per curve piece. */
  lines: {
    count: number;
    positions: Float32Array;
    t: Float32Array;
    cat: Float32Array;
    seed: Float32Array;
    flow: Float32Array;
    color: Float32Array;
  };
  /** Impulse sprites: `position` is the curve end (beacon), plus start and control. */
  pulses: {
    count: number;
    positions: Float32Array;
    start: Float32Array;
    control: Float32Array;
    cat: Float32Array;
    seed: Float32Array;
    slot: Float32Array;
    color: Float32Array;
  };
}

export function buildSelectionGeometry(model: UniverseModel, segments: number): SelectionGeometry {
  const pieces = Math.max(1, Math.round(segments));
  const beacon = model.configurator.position;
  const links = model.categories.map((node, index) => {
    const start = node.position;
    const control = bowControlPoint(start, beacon);
    const length = Math.hypot(beacon[0] - start[0], beacon[1] - start[1], beacon[2] - start[2]);
    const seed = fract(Math.sin((index + 1) * 78.233) * 43758.5453);
    return { node, start, control, seed, ...packetFlow(length) };
  });

  const lineVertices = links.length * pieces * 2;
  const lines = {
    count: lineVertices,
    positions: new Float32Array(lineVertices * 3),
    t: new Float32Array(lineVertices),
    cat: new Float32Array(lineVertices),
    seed: new Float32Array(lineVertices),
    flow: new Float32Array(lineVertices * 2),
    color: new Float32Array(lineVertices * 3),
  };
  const pulseCount = links.reduce((sum, link) => sum + link.packets, 0);
  const pulses = {
    count: pulseCount,
    positions: new Float32Array(pulseCount * 3),
    start: new Float32Array(pulseCount * 3),
    control: new Float32Array(pulseCount * 3),
    cat: new Float32Array(pulseCount),
    seed: new Float32Array(pulseCount),
    slot: new Float32Array(pulseCount * 2),
    color: new Float32Array(pulseCount * 3),
  };

  const color = new Color();
  let v = 0;
  let p = 0;
  for (const link of links) {
    color.set(link.node.color);
    for (let s = 0; s < pieces; s++) {
      for (const step of [s, s + 1]) {
        const u = step / pieces;
        const w = 1 - u;
        for (let axis = 0; axis < 3; axis++) {
          lines.positions[v * 3 + axis] =
            w * w * link.start[axis]! + 2 * w * u * link.control[axis]! + u * u * beacon[axis]!;
        }
        lines.t[v] = u;
        lines.cat[v] = link.node.index;
        lines.seed[v] = link.seed;
        lines.flow.set([link.packets, link.rate], v * 2);
        lines.color.set([color.r, color.g, color.b], v * 3);
        v++;
      }
    }
    for (let k = 0; k < link.packets; k++) {
      pulses.positions.set(beacon, p * 3);
      pulses.start.set(link.start, p * 3);
      pulses.control.set(link.control, p * 3);
      pulses.cat[p] = link.node.index;
      pulses.seed[p] = link.seed / link.packets;
      pulses.slot.set([k / link.packets, link.rate / link.packets], p * 2);
      pulses.color.set([color.r, color.g, color.b], p * 3);
      p++;
    }
  }
  return { lines, pulses };
}

function fract(value: number): number {
  return value - Math.floor(value);
}
