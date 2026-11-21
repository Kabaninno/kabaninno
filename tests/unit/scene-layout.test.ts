import { describe, expect, it } from 'vitest';
import { layoutCategoryNodes, UNIVERSE_RADIUS } from '@/scene/layout';
import type { Vec3 } from '@/scene/types';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('layoutCategoryNodes', () => {
  it('returns one position per category', () => {
    expect(layoutCategoryNodes(0)).toEqual([]);
    expect(layoutCategoryNodes(5)).toHaveLength(5);
    expect(layoutCategoryNodes(8)).toHaveLength(8);
  });

  it.each([3, 5, 7, 12])('places %i nodes at clearly distinct positions', (count) => {
    const positions = layoutCategoryNodes(count);
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        expect(distance(positions[i]!, positions[j]!)).toBeGreaterThan(1);
      }
    }
  });

  it('keeps auto-placed nodes on the ring radius (x/z ellipse)', () => {
    for (const [x, , z] of layoutCategoryNodes(5)) {
      const ellipse = (x / UNIVERSE_RADIUS) ** 2 + (z / (UNIVERSE_RADIUS * 0.55)) ** 2;
      expect(ellipse).toBeCloseTo(1, 2);
    }
  });

  it('respects position overrides and lays out the rest', () => {
    const override: Vec3 = [1, 2, 3];
    const positions = layoutCategoryNodes(5, [undefined, override]);
    expect(positions[1]).toEqual(override);
    expect(positions[0]).toEqual(layoutCategoryNodes(5)[0]);
    expect(positions[2]).toEqual(layoutCategoryNodes(5)[2]);
  });

  it('is deterministic', () => {
    expect(layoutCategoryNodes(5)).toEqual(layoutCategoryNodes(5));
    expect(layoutCategoryNodes(5, [], 20)).toEqual(layoutCategoryNodes(5, [], 20));
  });

  it('scales with the radius', () => {
    const [first] = layoutCategoryNodes(5, [], 10);
    const [scaled] = layoutCategoryNodes(5, [], 20);
    expect(scaled![0]).toBeCloseTo(first![0] * 2, 2);
    expect(scaled![2]).toBeCloseTo(first![2] * 2, 2);
  });
});
