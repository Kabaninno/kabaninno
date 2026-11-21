import { describe, expect, it } from 'vitest';
import { QUALITY_PRESETS, initialQualityTier, parseQualityOverride, stepQuality } from './quality';

describe('quality tiers', () => {
  it('scales budgets down from high to low and drops bloom on low', () => {
    const { high, medium, low } = QUALITY_PRESETS;
    for (const key of ['clusterPoints', 'minorNodes', 'orbitSegments', 'linkSegments'] as const) {
      expect(high[key]).toBeGreaterThan(medium[key]);
      expect(medium[key]).toBeGreaterThan(low[key]);
    }
    expect(high.bloom).not.toBeNull();
    expect(medium.bloom).not.toBeNull();
    expect(low.bloom).toBeNull();
    expect(low.lowQualityShaders).toBe(true);
    // DPR shares never exceed the capped device ratio.
    for (const preset of [high, medium, low]) expect(preset.dprScale).toBeLessThanOrEqual(1);
  });

  it('steps between tiers and clamps at the ends', () => {
    expect(stepQuality('high', -1)).toBe('medium');
    expect(stepQuality('medium', -1)).toBe('low');
    expect(stepQuality('low', -1)).toBe('low');
    expect(stepQuality('low', 1)).toBe('medium');
    expect(stepQuality('high', 1)).toBe('high');
  });

  it('guesses a starting tier from the device', () => {
    expect(initialQualityTier({ coarsePointer: false, hardwareConcurrency: 12 })).toBe('high');
    expect(initialQualityTier({ coarsePointer: true, hardwareConcurrency: 8 })).toBe('medium');
    expect(
      initialQualityTier({ coarsePointer: true, hardwareConcurrency: 8, deviceMemory: 2 }),
    ).toBe('low');
    expect(initialQualityTier({ coarsePointer: false, hardwareConcurrency: 4 })).toBe('low');
    expect(initialQualityTier({ coarsePointer: false })).toBe('high');
  });

  it('reads the ?quality= override', () => {
    expect(parseQualityOverride('?quality=high')).toBe('high');
    expect(parseQualityOverride('?debug=1&quality=low')).toBe('low');
    expect(parseQualityOverride('?quality=ultra')).toBeNull();
    expect(parseQualityOverride('')).toBeNull();
  });
});
