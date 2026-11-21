import { SYSTEM_BASE_TILT } from '../config';
import { orbitPosition } from '../orbit-math';
import type { Vec3 } from '../types';
import type { OrbitPreview } from '../universe/model';

/**
 * Pure planet maths shared by the system view, the camera goals and tests.
 * Planets move on the orbits of the universe preview (orbit-math.ts) inside
 * a system plane tilted by SYSTEM_BASE_TILT around X — the same transform
 * CategoryNode applies to the preview, so the dive lands on exactly the
 * orbits the visitor saw from afar.
 */

/** Planet speed multipliers: hovered planets slow down, the focused one parks. */
export const PLANET_SPEED = { normal: 1, hovered: 0.22, focused: 0 } as const;

/** Shell radius relative to the planet. */
export const SHELL_SCALE = 1.32;

/** Angle on the orbit with no hover/focus slow-down (what the universe sparks show). */
export function freeOrbitAngle(orbit: Pick<OrbitPreview, 'phase' | 'speed'>, time: number): number {
  return orbit.phase + orbit.speed * time;
}

/** Planet centre relative to its system centre, world units (system plane tilt applied). */
export function planetLocalPosition(orbit: OrbitPreview, angle: number): Vec3 {
  const p = orbitPosition(orbit, angle, { x: 0, y: 0, z: 0 });
  const c = Math.cos(SYSTEM_BASE_TILT);
  const s = Math.sin(SYSTEM_BASE_TILT);
  return [p.x, p.y * c - p.z * s, p.y * s + p.z * c];
}

export function planetWorldPosition(center: Vec3, orbit: OrbitPreview, angle: number): Vec3 {
  const local = planetLocalPosition(orbit, angle);
  return [center[0] + local[0], center[1] + local[1], center[2] + local[2]];
}

/** World radius enclosing the planet with its shell, rings and moons. */
export function planetReach(orbit: OrbitPreview): number {
  const { planet } = orbit;
  let reach = planet.shell === 'none' ? 1 : SHELL_SCALE;
  for (const ring of planet.rings) reach = Math.max(reach, ring.outer);
  if (planet.moons) reach = Math.max(reach, planet.moons.radius + 0.25);
  // Elongated shapes poke out of the unit sphere.
  if (planet.shape === 'crystal' || planet.shape === 'dart') reach = Math.max(reach, 1.5);
  return orbit.size * reach;
}

/** Target speed multiplier for a planet. */
export function planetSpeedTarget(focused: boolean, hovered: boolean): number {
  if (focused) return PLANET_SPEED.focused;
  return hovered ? PLANET_SPEED.hovered : PLANET_SPEED.normal;
}

/** Smallest on-screen planet diameter before the boost kicks in, CSS px (visual MJ2). */
export const MIN_PLANET_DIAMETER_PX = 16;
/** Largest on-screen boost of a small planet. */
export const MAX_PLANET_BOOST = 1.8;

/**
 * Scale boost that keeps a planet readable in small free areas (phone system
 * views): planets under MIN_PLANET_DIAMETER_PX grow, up to MAX_PLANET_BOOST.
 * 1 for planets that are already big enough (desktop, planet focus).
 */
export function planetScreenBoost(size: number, pxPerUnit: number): number {
  const px = 2 * size * pxPerUnit;
  if (!(px > 0)) return 1;
  return Math.min(Math.max(MIN_PLANET_DIAMETER_PX / px, 1), MAX_PLANET_BOOST);
}
