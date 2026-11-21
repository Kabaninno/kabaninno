import type { SceneTarget } from '@/lib/route-state';
import type { Vec3 } from '../types';

/**
 * Pure flight math for the camera director. Camera poses are expressed the
 * way camera-controls stores them: an orbit target plus spherical coordinates
 * (three.js `Spherical`: azimuth = atan2(x, z) around +Y, polar from +Y).
 * Flights interpolate in that space — target linearly, radius in log space (a
 * dive feels like a constant zoom rate instead of a slow start and a sudden
 * crash), angles along the shortest arc — and the director drives the
 * channels with a GSAP timeline (easing per channel, see `flightTimeline`).
 */
export interface OrbitPose {
  target: Vec3;
  radius: number;
  /** Radians, around +Y, measured from +Z toward +X. */
  azimuth: number;
  /** Radians from +Y (0 = looking straight down). */
  polar: number;
}

export function poseFromLookAt(position: Vec3, lookAt: Vec3): OrbitPose {
  const dx = position[0] - lookAt[0];
  const dy = position[1] - lookAt[1];
  const dz = position[2] - lookAt[2];
  const radius = Math.max(Math.hypot(dx, dy, dz), 1e-6);
  return {
    target: [lookAt[0], lookAt[1], lookAt[2]],
    radius,
    azimuth: Math.atan2(dx, dz),
    polar: Math.acos(clamp(dy / radius, -1, 1)),
  };
}

export function poseToPosition(pose: OrbitPose): Vec3 {
  const ring = Math.sin(pose.polar) * pose.radius;
  return [
    pose.target[0] + ring * Math.sin(pose.azimuth),
    pose.target[1] + Math.cos(pose.polar) * pose.radius,
    pose.target[2] + ring * Math.cos(pose.azimuth),
  ];
}

/** Wraps an angle to (-π, π]. */
export function wrapAngle(angle: number): number {
  const tau = Math.PI * 2;
  let a = (angle + Math.PI) % tau;
  if (a <= 0) a += tau;
  return a - Math.PI;
}

/** Signed shortest rotation from `from` to `to`, in (-π, π]. */
export function shortestAngleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** Eased channel values (0..1) of a flight at one moment. */
export interface FlightChannels {
  /** Orbit target travel. */
  look: number;
  /** Distance travel (log space). */
  dolly: number;
  /** Azimuth/polar travel. */
  orbit: number;
  /** Mid-flight pull-back bump, 0 → 1 → 0. */
  arc: number;
}

/**
 * Log-radius bump for flights between far-apart focus points (system →
 * system, system → portfolio): the camera rises, glimpses the network and
 * dives again instead of skimming through it at close range.
 */
export function flightHop(from: OrbitPose, to: OrbitPose): number {
  const travel = distance(from.target, to.target);
  // Measured against the wider view: a dive from the overview needs no hop.
  const reach = 2 * Math.max(from.radius, to.radius, 1e-3);
  return clamp(Math.log(1 + travel / reach) * 0.8, 0, 1.1);
}

export function interpolatePose(
  from: OrbitPose,
  to: OrbitPose,
  channels: FlightChannels,
  hop: number,
): OrbitPose {
  const { look, dolly, orbit, arc } = channels;
  const logRadius = lerp(Math.log(from.radius), Math.log(to.radius), dolly) + hop * arc;
  return {
    target: [
      lerp(from.target[0], to.target[0], look),
      lerp(from.target[1], to.target[1], look),
      lerp(from.target[2], to.target[2], look),
    ],
    radius: Math.exp(logRadius),
    azimuth: from.azimuth + shortestAngleDelta(from.azimuth, to.azimuth) * orbit,
    polar: lerp(from.polar, to.polar, orbit),
  };
}

/**
 * - dive: into a category system from anywhere else but another system;
 * - surface: back to the universe overview;
 * - travel: between two distant focus points (system → other system,
 *   universe/system → portfolio or configurator);
 * - local: within one focus (system ↔ planet, portfolio ↔ project).
 */
export type FlightKind = 'dive' | 'surface' | 'travel' | 'local';

export function classifyFlight(from: SceneTarget, to: SceneTarget): FlightKind {
  const fromCategory = categoryOf(from);
  const toCategory = categoryOf(to);
  if (toCategory !== null) {
    if (fromCategory === toCategory) return 'local';
    return fromCategory === null ? 'dive' : 'travel';
  }
  if (isOverview(to)) return isOverview(from) ? 'local' : 'surface';
  const portfolioSide = (t: SceneTarget) => t.mode === 'portfolio' || t.mode === 'project';
  if (portfolioSide(from) && portfolioSide(to)) return 'local';
  return 'travel';
}

export function isOverview(target: SceneTarget): boolean {
  return target.mode === 'universe' || target.mode === 'unknown';
}

function categoryOf(target: SceneTarget): string | null {
  return target.mode === 'system' || target.mode === 'planet' ? target.category : null;
}

/** One animated channel of the flight timeline (seconds, GSAP ease name). */
export interface ChannelWindow {
  start: number;
  duration: number;
  ease: string;
}

export interface FlightProfile {
  look: { delay: number; share: number; ease: string };
  dolly: { delay: number; share: number; ease: string };
  orbit: { delay: number; share: number; ease: string };
  /** FOV widening at mid-flight, degrees (speed sensation). */
  punchDeg: number;
  /** Peak bloom flash on arrival (0 = none); only when arriving in a system. */
  flash: number;
}

/**
 * Art direction: heavy and calm, power3/expo inOut, no springs. The dive lets
 * the target lead (the node slides to the frame centre first) and the dolly
 * follow on an expo curve; surfacing pulls back first and recentres later.
 */
export const FLIGHT_PROFILES: Record<FlightKind, FlightProfile> = {
  dive: {
    look: { delay: 0, share: 0.8, ease: 'power3.inOut' },
    dolly: { delay: 0.1, share: 0.9, ease: 'expo.inOut' },
    orbit: { delay: 0, share: 0.92, ease: 'power2.inOut' },
    punchDeg: 7,
    flash: 1,
  },
  surface: {
    look: { delay: 0.12, share: 0.88, ease: 'power3.inOut' },
    dolly: { delay: 0, share: 0.9, ease: 'power3.inOut' },
    orbit: { delay: 0.05, share: 0.95, ease: 'power2.inOut' },
    punchDeg: 5,
    flash: 0,
  },
  travel: {
    look: { delay: 0, share: 0.9, ease: 'power3.inOut' },
    dolly: { delay: 0, share: 1, ease: 'power3.inOut' },
    orbit: { delay: 0, share: 0.95, ease: 'power2.inOut' },
    punchDeg: 4,
    flash: 0.6,
  },
  local: {
    look: { delay: 0, share: 1, ease: 'power3.inOut' },
    dolly: { delay: 0, share: 1, ease: 'power3.inOut' },
    orbit: { delay: 0, share: 1, ease: 'power3.inOut' },
    punchDeg: 0,
    flash: 0,
  },
};

/** BRIEF: 1.2–2 s; art direction: 1.4–1.8 s for the main flights. */
export const FLIGHT_DURATION = { min: 1.2, max: 2.0, localMax: 1.4 } as const;

/** Longer journeys (more zoom, more travel, a hop) take a little longer. */
export function flightDuration(from: OrbitPose, to: OrbitPose, kind: FlightKind): number {
  const zoom = Math.abs(Math.log(to.radius / from.radius));
  const travel = distance(from.target, to.target);
  const raw = 1.2 + 0.16 * zoom + 0.007 * travel + 0.25 * flightHop(from, to);
  const max = kind === 'local' ? FLIGHT_DURATION.localMax : FLIGHT_DURATION.max;
  return clamp(raw, FLIGHT_DURATION.min, max);
}

/** Channel windows for a flight of `duration` seconds; every channel ends by `duration`. */
export function flightTimeline(kind: FlightKind, duration: number) {
  const profile = FLIGHT_PROFILES[kind];
  const windowOf = (channel: FlightProfile['look']): ChannelWindow => {
    const start = channel.delay * duration;
    return {
      start,
      duration: Math.min(channel.share * duration, duration - start),
      ease: channel.ease,
    };
  };
  const dolly = windowOf(profile.dolly);
  return {
    look: windowOf(profile.look),
    dolly,
    orbit: windowOf(profile.orbit),
    /** Arc rises and falls over the dolly window. */
    arcUp: { start: dolly.start, duration: dolly.duration / 2, ease: 'sine.out' },
    arcDown: {
      start: dolly.start + dolly.duration / 2,
      duration: dolly.duration / 2,
      ease: 'sine.in',
    },
    punchUp: { start: 0, duration: duration * 0.5, ease: 'sine.inOut' },
    punchDown: { start: duration * 0.5, duration: duration * 0.5, ease: 'sine.inOut' },
    /** The flash peaks right at arrival and decays after the camera settled. */
    flashUp: { start: Math.max(duration - 0.14, 0), duration: 0.16, ease: 'power2.out' },
    flashDown: { start: duration + 0.02, duration: 0.85, ease: 'power2.inOut' },
  };
}

/** Store value for `flight.progress`: clamped, two decimals (limits store churn). */
export function quantizeProgress(progress: number): number {
  return Math.round(clamp(progress, 0, 1) * 100) / 100;
}

/**
 * Idle auto-rotate as a slow azimuth sway around where the visitor left the
 * camera: the universe ring is an ellipse, so a full turn would stack the
 * nodes; a ±amplitude sway keeps the composition and still reads as a slow
 * drift. Returns the azimuth offset for `idleSeconds` of idling, ramping in
 * smoothly so the motion never starts with a jolt.
 */
export function idleSway(idleSeconds: number, amplitude: number, period: number, rampIn: number) {
  if (idleSeconds <= 0) return 0;
  const t = clamp(idleSeconds / rampIn, 0, 1);
  const envelope = t * t * (3 - 2 * t);
  return amplitude * envelope * Math.sin((idleSeconds / period) * Math.PI * 2);
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
