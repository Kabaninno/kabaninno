import { describe, expect, it } from 'vitest';
import { minCoreDiameterPx } from '../camera/goals';
import {
  coreWorldRadius,
  orbitClearanceScale,
  pixelsPerUnit,
  smallCoreBoost,
  nodeVisualRadiusPx,
  presenceInFrame,
} from './screen-size';

describe('screen-size rules', () => {
  it('converts world units to CSS px at a depth', () => {
    // 900 px tall viewport, 50° FOV, 40 units away: ~24 px per unit.
    expect(pixelsPerUnit(900, 50, 40)).toBeCloseTo(900 / (2 * Math.tan((25 * Math.PI) / 180) * 40));
  });

  it('enforces the minimum on-screen core size from afar and the true size up close', () => {
    const far = pixelsPerUnit(900, 50, 40);
    const near = pixelsPerUnit(900, 50, 4);
    const base = 0.24;
    expect(coreWorldRadius(base, 28, far) * 2 * far).toBeCloseTo(28);
    expect(coreWorldRadius(base, 28, near)).toBe(base);
    // On screen the core only grows while the camera approaches (never shrinks or pops).
    let previous = 0;
    for (let depth = 60; depth >= 2; depth -= 0.5) {
      const ppu = pixelsPerUnit(900, 50, depth);
      const px = coreWorldRadius(base, 28, ppu) * 2 * ppu;
      expect(px).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = px;
    }
  });

  it('gives the desktop home frame 28 px cores and small frames a readable minimum', () => {
    expect(minCoreDiameterPx(824, 564)).toBeCloseTo(28.2);
    expect(minCoreDiameterPx(390, 376)).toBeGreaterThanOrEqual(18);
    expect(minCoreDiameterPx(404, 266)).toBeGreaterThanOrEqual(12);
    expect(minCoreDiameterPx(4000, 4000)).toBe(30);
    expect(minCoreDiameterPx(0, 0)).toBe(20);
  });

  it('widens the orbit preview only as much as an enlarged core needs', () => {
    expect(orbitClearanceScale(0.24, 0.6)).toBe(1);
    expect(orbitClearanceScale(0.6, 0.6)).toBeCloseTo(1.3);
    expect(orbitClearanceScale(0.5, 0)).toBe(1);
  });

  it('boosts only small cores', () => {
    expect(smallCoreBoost(10)).toBe(1);
    expect(smallCoreBoost(40)).toBe(0);
    expect(smallCoreBoost(20)).toBeGreaterThan(0);
    expect(smallCoreBoost(20)).toBeLessThan(1);
  });
});

describe('node presence by visual extent (MN-2, S5, S6)', () => {
  const frame = { left: 0, top: 64, right: 390, bottom: 364 };

  it('measures what a node visibly occupies, not just its core', () => {
    // A category's orbit preview reaches far beyond its core.
    expect(nodeVisualRadiusPx('category', 20, 40, 1.6)).toBeCloseTo(1.6 * 0.8 * 40, 9);
    expect(nodeVisualRadiusPx('category', 20, 1, 1.6)).toBeCloseTo(16, 9);
    // The beacon's crystal is stretched 1.6× and glows.
    expect(nodeVisualRadiusPx('configurator', 20, 40)).toBeGreaterThan(20);
    expect(nodeVisualRadiusPx('portfolio', 20, 40)).toBeGreaterThanOrEqual(80);
  });

  it('fades a node whose visible extent crosses the frame edge (HUD, panel, sheet)', () => {
    expect(presenceInFrame(200, 200, 30, frame)).toBe(1);
    // Centre inside, but the crystal reaches under the HUD (S5).
    const beacon = nodeVisualRadiusPx('configurator', 30, 40);
    expect(presenceInFrame(60, 64 + 2, beacon, frame)).toBeLessThan(0.05);
    // Orbits cut by the panel edge on the right (S6).
    const automation = nodeVisualRadiusPx('category', 18, 60, 1.6);
    expect(presenceInFrame(370, 250, automation, frame)).toBeLessThan(0.05);
    // Just touching the edge (within the tolerance) stays.
    expect(presenceInFrame(200, 64 + 30 - 5, 30, frame)).toBe(1);
  });
});
