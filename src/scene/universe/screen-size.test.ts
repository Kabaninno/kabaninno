import { describe, expect, it } from 'vitest';
import { minCoreDiameterPx } from '../camera/goals';
import { coreWorldRadius, orbitClearanceScale, pixelsPerUnit, smallCoreBoost } from './screen-size';

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
