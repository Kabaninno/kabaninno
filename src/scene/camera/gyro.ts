import { dampFactor } from './damp';

/**
 * Gyroscope parallax (B1): on phones, tilting the device turns the home view
 * a few degrees around its pivot, relative to how the phone was held, eased so
 * it never jitters. Pure and three-free: the DOM listener (`GyroParallax`)
 * only feeds `readTilt`, the camera director calls `stepGyro` once per frame.
 *
 * Conventions (degrees): `deviceorientation` gives `beta` (front-back tilt,
 * -180..180) and `gamma` (left-right tilt, -90..90), both in the device's own
 * axes. `screenTilt` turns them into screen axes for the current screen
 * orientation: x > 0 = the screen's right side tilted down, y > 0 = its top
 * edge tilted away.
 */
export const GYRO = {
  /** Largest turn of the view (degrees): around the vertical axis and up/down. */
  maxAzimuthDeg: 6,
  maxPolarDeg: 3.5,
  /** View turn per degree of device tilt. */
  gainAzimuth: 0.45,
  gainPolar: 0.3,
  /** Exponential smoothing rate of the view (1/s): ~0.25 s to settle. */
  rate: 5,
  /**
   * Time constant (s) at which the reference orientation follows the device:
   * the parallax is relative to how the phone is held, so it fades back to
   * rest when the phone stays put instead of sticking at its limit.
   */
  baselineSeconds: 12,
  /** Tilt change (degrees) ignored as sensor noise. */
  deadZoneDeg: 0.35,
} as const;

/** What the gyro decision looks at (read from the browser by `GyroParallax`). */
export interface GyroEnvironment {
  /** `DeviceOrientationEvent` exists. */
  hasOrientationEvent: boolean;
  /** `DeviceOrientationEvent.requestPermission` is a function. */
  permissionApi: boolean;
  /** A Chromium engine (`navigator.userAgentData` exists). */
  chromium: boolean;
  /** The primary pointer is coarse (a touch device). */
  coarsePointer: boolean;
}

/**
 * Whether the gyro parallax may listen at all. Touch devices only (that is
 * where the sensor lives). iOS and Safari hide the sensor behind
 * `requestPermission()`, a system dialog this site never shows: there the gyro
 * is simply not used. Chromium also exposes that function nowadays, but reads
 * the sensor without a prompt, so Android Chrome is on automatically. Desktops
 * and anything without readings change nothing (`readTilt` ignores nulls).
 */
export function gyroAvailable(env: GyroEnvironment): boolean {
  if (!env.hasOrientationEvent || !env.coarsePointer) return false;
  if (env.permissionApi && !env.chromium) return false;
  return true;
}

/** Latest device tilt in screen axes plus the reference it is measured against. */
export interface GyroInput {
  /** Real beta/gamma readings have arrived (a desktop reports nulls: stays false). */
  live: boolean;
  /** Screen orientation angle of the last reading (0, 90, 180, 270). */
  angle: number;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
}

export function createGyroInput(): GyroInput {
  return { live: false, angle: 0, x: 0, y: 0, baseX: 0, baseY: 0 };
}

/**
 * Device tilt in screen axes: the (gamma, beta) vector rotated by minus the
 * screen's orientation angle (the same rule three.js' DeviceOrientationControls
 * applies), so a phone held in landscape tilts the same way the scene turns.
 */
export function screenTilt(
  beta: number,
  gamma: number,
  angleDeg: number,
): { x: number; y: number } {
  const a = (normalizeAngle(angleDeg) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: gamma * cos + beta * sin, y: beta * cos - gamma * sin };
}

/** 0, 90, 180, 270 (the platforms report -90 and 270 for the same orientation). */
export function normalizeAngle(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  return (((Math.round(angleDeg / 90) * 90) % 360) + 360) % 360;
}

/**
 * Feeds one `deviceorientation` reading. Returns false (and changes nothing)
 * for readings without real values (`null` on desktops, NaN). The first real
 * reading, and the first one after the screen rotated, becomes the reference.
 */
export function readTilt(
  input: GyroInput,
  beta: number | null,
  gamma: number | null,
  angleDeg: number,
): boolean {
  if (typeof beta !== 'number' || typeof gamma !== 'number') return false;
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return false;
  const angle = normalizeAngle(angleDeg);
  const tilt = screenTilt(beta, gamma, angle);
  if (!input.live || angle !== input.angle) {
    // Orientation at start, and again after the screen rotated: the baseline.
    input.baseX = tilt.x;
    input.baseY = tilt.y;
    input.angle = angle;
  }
  input.live = true;
  input.x = tilt.x;
  input.y = tilt.y;
  return true;
}

/** The view's turn (degrees) the gyro adds to the camera, smoothed. */
export interface GyroPose {
  azimuthDeg: number;
  polarDeg: number;
}

export function createGyroPose(): GyroPose {
  return { azimuthDeg: 0, polarDeg: 0 };
}

/** Maps a tilt relative to the reference to the view's turn (degrees), clamped. */
export function tiltToTurn(relX: number, relY: number): GyroPose {
  const dead = (value: number) =>
    Math.abs(value) <= GYRO.deadZoneDeg ? 0 : value - Math.sign(value) * GYRO.deadZoneDeg;
  return {
    azimuthDeg: clamp(dead(relX) * GYRO.gainAzimuth, -GYRO.maxAzimuthDeg, GYRO.maxAzimuthDeg),
    polarDeg: clamp(dead(relY) * GYRO.gainPolar, -GYRO.maxPolarDeg, GYRO.maxPolarDeg),
  };
}

/**
 * One frame: the reference follows the device slowly, then `pose` eases toward
 * the turn the current tilt asks for (or back to rest without readings).
 * `enabled` false (touching, flights) freezes `pose` where it is. Returns `pose`.
 */
export function stepGyro(pose: GyroPose, input: GyroInput, dt: number, enabled: boolean): GyroPose {
  if (!(dt > 0)) return pose;
  if (input.live) {
    const follow = dampFactor(1 / GYRO.baselineSeconds, dt);
    input.baseX += (input.x - input.baseX) * follow;
    input.baseY += (input.y - input.baseY) * follow;
  }
  if (!enabled) return pose;
  // Without readings (listener removed: hidden tab, reduced motion) the view eases back to rest.
  const target = input.live
    ? tiltToTurn(input.x - input.baseX, input.y - input.baseY)
    : { azimuthDeg: 0, polarDeg: 0 };
  const k = dampFactor(GYRO.rate, dt);
  pose.azimuthDeg += (target.azimuthDeg - pose.azimuthDeg) * k;
  pose.polarDeg += (target.polarDeg - pose.polarDeg) * k;
  return pose;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
