import { describe, expect, it } from 'vitest';
import { dampFactor, smoothDamp, smoothDampVec3 } from './damp';

describe('smoothDamp', () => {
  it('converges to the target without overshooting', () => {
    const state = { value: 0, velocity: 0 };
    let previous = 0;
    for (let frame = 0; frame < 240; frame++) {
      const value = smoothDamp(state, 10, 0.6, 1 / 60);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(10);
      previous = value;
    }
    expect(state.value).toBeCloseTo(10, 2);
  });

  it('is roughly frame-rate independent', () => {
    const at60 = { value: 0, velocity: 0 };
    const at30 = { value: 0, velocity: 0 };
    for (let i = 0; i < 60; i++) smoothDamp(at60, 1, 0.6, 1 / 60);
    for (let i = 0; i < 30; i++) smoothDamp(at30, 1, 0.6, 1 / 30);
    expect(Math.abs(at60.value - at30.value)).toBeLessThan(0.02);
  });

  it('does nothing for a zero time step', () => {
    const state = { value: 3, velocity: 1 };
    expect(smoothDamp(state, 10, 0.5, 0)).toBe(3);
  });
});

describe('smoothDampVec3', () => {
  it('moves all axes toward the target', () => {
    const current = { x: 0, y: 0, z: 0 };
    const velocity = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 300; i++)
      smoothDampVec3(current, { x: 1, y: -2, z: 3 }, velocity, 0.5, 1 / 60);
    expect(current.x).toBeCloseTo(1, 3);
    expect(current.y).toBeCloseTo(-2, 3);
    expect(current.z).toBeCloseTo(3, 3);
  });
});

describe('dampFactor', () => {
  it('is 0 for no time and approaches 1 for long steps', () => {
    expect(dampFactor(10, 0)).toBe(0);
    expect(dampFactor(10, 10)).toBeCloseTo(1, 6);
  });
});
