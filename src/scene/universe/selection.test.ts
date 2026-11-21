import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import type { SceneManifest } from '../types';
import { buildUniverseModel } from './model';
import {
  FOCUSED_NETWORK,
  SELECT_SECONDS,
  createUniverseRuntime,
  easeSelection,
  neighbourDim,
  stepSelection,
} from './runtime';
import { bowControlPoint } from './network-model';
import { PACKET_SPEED, buildSelectionGeometry, packetFlow } from './selection-model';

function manifestWith(categoryCount: number): SceneManifest {
  return {
    labels: { portfolio: 'Portfolio', configurator: 'Configurator', comingSoon: 'Soon' },
    categories: getCategories()
      .slice(0, categoryCount)
      .map((category) => ({
        id: category.id,
        label: category.id,
        dna: category.dna,
        services: category.services.map((service) => ({
          slug: service.slug,
          label: service.slug,
          planet: service.planet,
        })),
      })),
    projects: [],
  };
}

describe('selected state easing (D81)', () => {
  it('takes SELECT_SECONDS for a full transition, both ways', () => {
    const dt = 1 / 60;
    let progress = 0;
    let elapsed = 0;
    while (progress < 1) {
      progress = stepSelection(progress, 1, dt, false);
      elapsed += dt;
    }
    expect(elapsed).toBeCloseTo(SELECT_SECONDS, 1);
    expect(stepSelection(0, 1, SELECT_SECONDS / 2, false)).toBeCloseTo(0.5, 9);
    expect(stepSelection(1, 0, SELECT_SECONDS / 4, false)).toBeCloseTo(0.75, 9);
    expect(stepSelection(0.9, 1, 1, false)).toBe(1);
    expect(stepSelection(0.1, 0, 1, false)).toBe(0);
  });

  it('applies changes instantly under reduced motion', () => {
    expect(stepSelection(0, 1, 0.001, true)).toBe(1);
    expect(stepSelection(1, 0, 0.001, true)).toBe(0);
  });

  it('eases in and out', () => {
    expect(easeSelection(0)).toBe(0);
    expect(easeSelection(1)).toBe(1);
    expect(easeSelection(0.5)).toBeCloseTo(0.5, 9);
    expect(easeSelection(0.1)).toBeLessThan(0.1);
    expect(easeSelection(0.9)).toBeGreaterThan(0.9);
    expect(easeSelection(-1)).toBe(0);
    expect(easeSelection(2)).toBe(1);
  });

  it('keeps selected nodes bright while the focused network dims the others', () => {
    const rt = createUniverseRuntime();
    rt.network = FOCUSED_NETWORK;
    expect(neighbourDim(rt, 0)).toBeCloseTo(0.35, 9);
    rt.selected[0] = 1;
    expect(neighbourDim(rt, 0)).toBeCloseTo(1, 9);
    rt.selected[0] = 0.5;
    expect(neighbourDim(rt, 0)).toBeCloseTo(0.675, 9);
  });
});

describe('selection link geometry', () => {
  const model = buildUniverseModel(manifestWith(5));
  const segments = 12;
  const geometry = buildSelectionGeometry(model, segments);

  it('wires every category to the beacon along the network bow', () => {
    const { lines } = geometry;
    expect(lines.count).toBe(model.categories.length * segments * 2);
    const beacon = model.configurator.position;
    model.categories.forEach((node, link) => {
      const first = link * segments * 2;
      const last = first + segments * 2 - 1;
      expect(lines.cat[first]).toBe(node.index);
      expect(lines.t[first]).toBe(0);
      expect(lines.t[last]).toBe(1);
      for (let axis = 0; axis < 3; axis++) {
        expect(lines.positions[first * 3 + axis]).toBeCloseTo(node.position[axis]!, 4);
        expect(lines.positions[last * 3 + axis]).toBeCloseTo(beacon[axis]!, 4);
      }
      // Midpoint of the quadratic curve: (start + 2·control + end) / 4.
      const control = bowControlPoint(node.position, beacon);
      const mid = first + segments; // first vertex of piece segments/2 → u = 0.5
      for (let axis = 0; axis < 3; axis++) {
        const expected = (node.position[axis]! + 2 * control[axis]! + beacon[axis]!) / 4;
        expect(lines.positions[mid * 3 + axis]).toBeCloseTo(expected, 4);
      }
    });
  });

  it('spaces impulses evenly and moves them at a constant world speed', () => {
    const { pulses } = geometry;
    let total = 0;
    for (const node of model.categories) {
      const beacon = model.configurator.position;
      const length = Math.hypot(
        beacon[0] - node.position[0],
        beacon[1] - node.position[1],
        beacon[2] - node.position[2],
      );
      const { packets, rate } = packetFlow(length);
      expect(packets).toBeGreaterThanOrEqual(2);
      expect((rate / packets) * length).toBeCloseTo(PACKET_SPEED, 9);
      total += packets;
    }
    expect(pulses.count).toBe(total);
    for (let i = 0; i < pulses.count; i++) {
      expect(pulses.slot[i * 2]).toBeGreaterThanOrEqual(0);
      expect(pulses.slot[i * 2]).toBeLessThan(1);
      expect(pulses.slot[i * 2 + 1]).toBeGreaterThan(0);
    }
  });

  it('follows the content: one link per category', () => {
    for (const count of [1, 3, 5]) {
      const small = buildUniverseModel(manifestWith(count));
      expect(buildSelectionGeometry(small, 4).lines.count).toBe(count * 4 * 2);
    }
  });
});
