/**
 * Orbit convention shared by the universe orbit preview (M1/M2) and the
 * planetary systems (M3). The GLSL twin lives in `shaders/chunks.ts`
 * (`orbitPositionGlsl`); keep both in sync.
 *
 * A point on an orbit at `angle` (radians):
 *   1. circle in the XZ plane: (r cos a, 0, r sin a)
 *   2. rotate around X by `tilt`
 *   3. rotate around Y by `yaw` (ascending node), so tilts do not share one axis
 * The whole system plane is additionally tilted by SYSTEM_BASE_TILT (group transform).
 */
export interface OrbitShape {
  radius: number;
  /** Radians. */
  tilt: number;
  /** Radians. */
  yaw: number;
}

export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

export function orbitPosition<T extends MutableVec3>(orbit: OrbitShape, angle: number, out: T): T {
  const x0 = Math.cos(angle) * orbit.radius;
  const z0 = Math.sin(angle) * orbit.radius;
  // Rotation around X (y = 0 before the rotation).
  const y1 = -z0 * Math.sin(orbit.tilt);
  const z1 = z0 * Math.cos(orbit.tilt);
  // Rotation around Y.
  const cy = Math.cos(orbit.yaw);
  const sy = Math.sin(orbit.yaw);
  out.x = x0 * cy + z1 * sy;
  out.y = y1;
  out.z = -x0 * sy + z1 * cy;
  return out;
}

/** Golden angle: spreads ascending nodes of successive orbits evenly. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const degToRad = (degrees: number): number => (degrees * Math.PI) / 180;
