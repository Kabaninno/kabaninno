import type { Planet } from '~/content/schema';

export type MoonKind = NonNullable<Planet['moons']>['kind'];

/** Pose of one moon in planet units (the planet has radius 1). */
export interface MoonPose {
  x: number;
  y: number;
  z: number;
  /** Euler XYZ rotation, radians. */
  rx: number;
  ry: number;
  rz: number;
  /** Scale per axis. */
  sx: number;
  sy: number;
  sz: number;
}

export function createMoonPose(): MoonPose {
  return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 };
}

/**
 * Moon systems by kind (pure, deterministic, per frame):
 * - orb: glowing spheres on alternately inclined orbits;
 * - cube: tumbling cubes on a slightly inclined ring;
 * - conveyor: boxes evenly spaced on a flat track, aligned with it, all moving
 *   together like a conveyor belt (the track is drawn as a ring);
 * - shard: thin crystals tumbling on steep alternating orbits.
 */
export function moonPose(
  kind: MoonKind,
  index: number,
  count: number,
  time: number,
  radius: number,
  speed: number,
  out: MoonPose,
): MoonPose {
  const slot = (index / Math.max(count, 1)) * Math.PI * 2;
  const alternate = index % 2 === 0 ? 1 : -1;
  let inclination = 0;
  let angle = slot + time * speed;
  switch (kind) {
    case 'orb':
      inclination = alternate * (0.3 + 0.08 * (index % 3));
      setScale(out, 0.16);
      out.rx = 0;
      out.ry = 0;
      out.rz = 0;
      break;
    case 'cube':
      inclination = 0.22;
      setScale(out, 0.15);
      out.rx = time * 0.9 + index;
      out.ry = time * 0.7;
      out.rz = 0;
      break;
    case 'conveyor':
      inclination = 0;
      angle = slot + time * speed * 0.5;
      out.sx = 0.11;
      out.sy = 0.09;
      out.sz = 0.26;
      out.rx = 0;
      // Tangent to the track: local Z along the direction of travel.
      out.ry = -angle;
      out.rz = 0;
      break;
    case 'shard':
      inclination = alternate * 0.55;
      out.sx = 0.07;
      out.sy = 0.21;
      out.sz = 0.07;
      out.rx = time * 0.8 + index * 1.7;
      out.ry = 0;
      out.rz = time * 0.5;
      break;
  }
  const c = Math.cos(angle) * radius;
  const s = Math.sin(angle) * radius;
  out.x = c;
  out.y = s * Math.sin(inclination);
  out.z = s * Math.cos(inclination);
  return out;
}

function setScale(out: MoonPose, value: number) {
  out.sx = value;
  out.sy = value;
  out.sz = value;
}
