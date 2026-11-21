import { describe, expect, it } from 'vitest';
import {
  GYRO,
  createGyroInput,
  createGyroPose,
  normalizeAngle,
  readTilt,
  screenTilt,
  stepGyro,
  tiltToTurn,
} from './gyro';

describe('screenTilt', () => {
  it('is the device tilt in portrait', () => {
    expect(screenTilt(10, -4, 0)).toEqual({ x: -4, y: 10 });
  });

  it('swaps the axes when the screen is rotated', () => {
    const quarter = screenTilt(10, -4, 90);
    expect(quarter.x).toBeCloseTo(10);
    expect(quarter.y).toBeCloseTo(4);
    const back = screenTilt(10, -4, 270);
    expect(back.x).toBeCloseTo(-10);
    expect(back.y).toBeCloseTo(-4);
    const flipped = screenTilt(10, -4, 180);
    expect(flipped.x).toBeCloseTo(4);
    expect(flipped.y).toBeCloseTo(-10);
  });

  it('treats -90 and 270 as the same orientation', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(Number.NaN)).toBe(0);
    expect(screenTilt(3, 5, -90)).toEqual(screenTilt(3, 5, 270));
  });
});

describe('readTilt', () => {
  it('ignores readings without real values (desktops report nulls)', () => {
    const input = createGyroInput();
    expect(readTilt(input, null, null, 0)).toBe(false);
    expect(readTilt(input, 10, null, 0)).toBe(false);
    expect(readTilt(input, Number.NaN, 3, 0)).toBe(false);
    expect(input.live).toBe(false);
  });

  it('takes the first real reading as the reference', () => {
    const input = createGyroInput();
    expect(readTilt(input, 62, 3, 0)).toBe(true);
    expect(input.live).toBe(true);
    expect(input.baseX).toBe(3);
    expect(input.baseY).toBe(62);
    readTilt(input, 70, 9, 0);
    expect(input.x - input.baseX).toBe(6);
    expect(input.y - input.baseY).toBe(8);
  });

  it('takes a new reference when the screen rotates', () => {
    const input = createGyroInput();
    readTilt(input, 60, 0, 0);
    readTilt(input, 60, 20, 0);
    expect(input.x - input.baseX).toBe(20);
    // Same posture, screen rotated to landscape: the tilt relative to the new reference is zero.
    readTilt(input, 5, -58, 90);
    expect(input.angle).toBe(90);
    expect(input.x - input.baseX).toBeCloseTo(0);
    expect(input.y - input.baseY).toBeCloseTo(0);
  });
});

describe('tiltToTurn', () => {
  it('maps tilt to a view turn within ±5–8° and clamps it', () => {
    expect(GYRO.maxAzimuthDeg).toBeGreaterThanOrEqual(5);
    expect(GYRO.maxAzimuthDeg).toBeLessThanOrEqual(8);
    expect(tiltToTurn(0, 0)).toEqual({ azimuthDeg: 0, polarDeg: 0 });
    expect(tiltToTurn(100, 0).azimuthDeg).toBe(GYRO.maxAzimuthDeg);
    expect(tiltToTurn(-100, 0).azimuthDeg).toBe(-GYRO.maxAzimuthDeg);
    expect(tiltToTurn(0, 100).polarDeg).toBe(GYRO.maxPolarDeg);
    expect(tiltToTurn(0, -100).polarDeg).toBe(-GYRO.maxPolarDeg);
  });

  it('ignores sensor noise and is monotonic and symmetric', () => {
    expect(tiltToTurn(GYRO.deadZoneDeg * 0.9, -GYRO.deadZoneDeg * 0.9)).toEqual({
      azimuthDeg: 0,
      polarDeg: 0,
    });
    expect(tiltToTurn(6, 0).azimuthDeg).toBeGreaterThan(tiltToTurn(3, 0).azimuthDeg);
    expect(tiltToTurn(-6, 0).azimuthDeg).toBeCloseTo(-tiltToTurn(6, 0).azimuthDeg);
  });
});

describe('stepGyro', () => {
  function live(beta: number, gamma: number) {
    const input = createGyroInput();
    readTilt(input, beta, gamma, 0);
    return input;
  }

  it('does nothing before a real reading arrives', () => {
    const pose = createGyroPose();
    stepGyro(pose, createGyroInput(), 0.016, true);
    expect(pose).toEqual({ azimuthDeg: 0, polarDeg: 0 });
  });

  it('eases toward the tilt without overshooting and settles within the clamp', () => {
    const input = live(50, 0);
    const pose = createGyroPose();
    readTilt(input, 50, 12, 0);
    let previous = 0;
    for (let i = 0; i < 20; i++) {
      stepGyro(pose, input, 1 / 60, true);
      expect(pose.azimuthDeg).toBeGreaterThanOrEqual(previous);
      expect(pose.azimuthDeg).toBeLessThanOrEqual(GYRO.maxAzimuthDeg);
      previous = pose.azimuthDeg;
    }
    // Smooth: after a third of a second it is well on its way, but not there in one frame.
    expect(pose.azimuthDeg).toBeGreaterThan(1);
    const first = createGyroPose();
    stepGyro(first, input, 1 / 60, true);
    expect(first.azimuthDeg).toBeLessThan(pose.azimuthDeg / 3);
  });

  it('is frame-rate independent', () => {
    const slow = live(50, 0);
    const fast = live(50, 0);
    readTilt(slow, 50, 12, 0);
    readTilt(fast, 50, 12, 0);
    const a = createGyroPose();
    const b = createGyroPose();
    for (let i = 0; i < 30; i++) stepGyro(a, slow, 1 / 30, true);
    for (let i = 0; i < 60; i++) stepGyro(b, fast, 1 / 60, true);
    expect(a.azimuthDeg).toBeCloseTo(b.azimuthDeg, 1);
  });

  it('freezes while disabled (touching, flights) and resumes after', () => {
    const input = live(50, 0);
    const pose = createGyroPose();
    readTilt(input, 50, 12, 0);
    for (let i = 0; i < 30; i++) stepGyro(pose, input, 1 / 60, true);
    const held = { ...pose };
    for (let i = 0; i < 60; i++) stepGyro(pose, input, 1 / 60, false);
    expect(pose).toEqual(held);
    stepGyro(pose, input, 1 / 60, true);
    expect(pose.azimuthDeg).not.toBe(held.azimuthDeg);
  });

  it('lets the reference follow the phone, so a held posture fades back to rest', () => {
    const input = live(50, 0);
    const pose = createGyroPose();
    readTilt(input, 50, 12, 0);
    for (let i = 0; i < 60 * 60; i++) stepGyro(pose, input, 1 / 60, true);
    expect(Math.abs(pose.azimuthDeg)).toBeLessThan(0.1);
  });

  it('eases back to rest once the readings stop (listener removed)', () => {
    const input = live(50, 0);
    const pose = createGyroPose();
    readTilt(input, 50, 12, 0);
    for (let i = 0; i < 30; i++) stepGyro(pose, input, 1 / 60, true);
    expect(pose.azimuthDeg).toBeGreaterThan(1);
    input.live = false;
    for (let i = 0; i < 120; i++) stepGyro(pose, input, 1 / 60, true);
    expect(Math.abs(pose.azimuthDeg)).toBeLessThan(0.05);
  });

  it('ignores a zero or negative time step', () => {
    const input = live(50, 0);
    readTilt(input, 50, 12, 0);
    const pose = createGyroPose();
    stepGyro(pose, input, 0, true);
    stepGyro(pose, input, -1, true);
    expect(pose).toEqual({ azimuthDeg: 0, polarDeg: 0 });
  });
});
