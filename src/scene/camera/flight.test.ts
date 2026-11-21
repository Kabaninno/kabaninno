import { describe, expect, it } from 'vitest';
import type { SceneTarget } from '@/lib/route-state';
import type { Vec3 } from '../types';
import {
  FLIGHT_DURATION,
  FLIGHT_PROFILES,
  classifyFlight,
  flightDuration,
  flightHop,
  flightTimeline,
  idleSway,
  interpolatePose,
  poseFromLookAt,
  poseToPosition,
  quantizeProgress,
  shortestAngleDelta,
  wrapAngle,
  type OrbitPose,
} from './flight';

const universe: SceneTarget = { mode: 'universe' };
const web: SceneTarget = { mode: 'system', category: 'web' };
const crm: SceneTarget = { mode: 'system', category: 'crm' };
const webPlanet: SceneTarget = { mode: 'planet', category: 'web', service: 'landing-pages' };
const portfolio: SceneTarget = { mode: 'portfolio' };
const project: SceneTarget = { mode: 'project', project: 'demo' };
const configurator: SceneTarget = { mode: 'configurator' };

const overviewPose: OrbitPose = { target: [0, 0, 0], radius: 40, azimuth: -0.4, polar: 1.1 };
const systemPose: OrbitPose = { target: [12, 1, -4], radius: 4, azimuth: -0.3, polar: 1.2 };

describe('orbit poses', () => {
  it('round-trips between camera position and pose', () => {
    const position: Vec3 = [3, 7, -2];
    const lookAt: Vec3 = [1, 2, 4];
    const pose = poseFromLookAt(position, lookAt);
    poseToPosition(pose).forEach((value, axis) => expect(value).toBeCloseTo(position[axis]!, 9));
    expect(pose.target).toEqual(lookAt);
  });

  it('wraps angles to (-π, π] and takes the short way round', () => {
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(3 * Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5);
    expect(shortestAngleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(shortestAngleDelta(-0.2, 0.3)).toBeCloseTo(0.5);
  });
});

describe('interpolatePose', () => {
  it('starts at the origin pose and ends exactly at the goal', () => {
    const zero = { look: 0, dolly: 0, orbit: 0, arc: 0 };
    const one = { look: 1, dolly: 1, orbit: 1, arc: 0 };
    const start = interpolatePose(overviewPose, systemPose, zero, 0.8);
    const end = interpolatePose(overviewPose, systemPose, one, 0.8);
    expect(start.radius).toBeCloseTo(overviewPose.radius);
    expect(start.target).toEqual(overviewPose.target);
    expect(end.radius).toBeCloseTo(systemPose.radius);
    end.target.forEach((value, axis) => expect(value).toBeCloseTo(systemPose.target[axis]!));
    expect(end.azimuth).toBeCloseTo(systemPose.azimuth);
    expect(end.polar).toBeCloseTo(systemPose.polar);
  });

  it('dollies in log space: the halfway radius is the geometric mean', () => {
    const half = interpolatePose(
      overviewPose,
      systemPose,
      { look: 0.5, dolly: 0.5, orbit: 0.5, arc: 0 },
      0,
    );
    expect(half.radius).toBeCloseTo(Math.sqrt(40 * 4));
  });

  it('lifts the camera by the hop at the top of the arc', () => {
    const channels = { look: 0.5, dolly: 0.5, orbit: 0.5, arc: 1 };
    const flat = interpolatePose(systemPose, systemPose, { ...channels, arc: 0 }, 0.7);
    const lifted = interpolatePose(systemPose, systemPose, channels, 0.7);
    expect(lifted.radius / flat.radius).toBeCloseTo(Math.exp(0.7));
  });
});

describe('flight classification and timing', () => {
  it('names the kind of every navigation', () => {
    expect(classifyFlight(universe, web)).toBe('dive');
    expect(classifyFlight(portfolio, web)).toBe('dive');
    expect(classifyFlight(web, universe)).toBe('surface');
    expect(classifyFlight(configurator, universe)).toBe('surface');
    expect(classifyFlight(web, crm)).toBe('travel');
    expect(classifyFlight(universe, portfolio)).toBe('travel');
    expect(classifyFlight(web, configurator)).toBe('travel');
    expect(classifyFlight(web, webPlanet)).toBe('local');
    expect(classifyFlight(webPlanet, web)).toBe('local');
    expect(classifyFlight(portfolio, project)).toBe('local');
  });

  it('keeps every flight within 1.2–2 s (local moves ≤ 1.4 s) and dives within 1.4–1.8 s', () => {
    const far: OrbitPose = { target: [-30, 10, -40], radius: 60, azimuth: 2, polar: 0.6 };
    for (const kind of ['dive', 'surface', 'travel', 'local'] as const) {
      for (const [a, b] of [
        [overviewPose, systemPose],
        [systemPose, overviewPose],
        [systemPose, far],
        [systemPose, systemPose],
      ] as const) {
        const duration = flightDuration(a, b, kind);
        expect(duration).toBeGreaterThanOrEqual(FLIGHT_DURATION.min);
        expect(duration).toBeLessThanOrEqual(
          kind === 'local' ? FLIGHT_DURATION.localMax : FLIGHT_DURATION.max,
        );
      }
    }
    const dive = flightDuration(overviewPose, systemPose, 'dive');
    expect(dive).toBeGreaterThanOrEqual(1.4);
    expect(dive).toBeLessThanOrEqual(1.8);
  });

  it('hops between distant focus points but not on a dive from far away', () => {
    const otherSystem: OrbitPose = { ...systemPose, target: [-12, 0, -4] };
    expect(flightHop(systemPose, otherSystem)).toBeGreaterThan(0.5);
    expect(flightHop(overviewPose, systemPose)).toBeLessThan(0.3);
    expect(flightHop(systemPose, systemPose)).toBe(0);
  });

  it('lays out channels that all finish by the end of the move', () => {
    for (const kind of ['dive', 'surface', 'travel', 'local'] as const) {
      const duration = 1.6;
      const windows = flightTimeline(kind, duration);
      for (const channel of [windows.look, windows.dolly, windows.orbit, windows.punchDown]) {
        expect(channel.start + channel.duration).toBeLessThanOrEqual(duration + 1e-9);
      }
      const ends = [windows.look, windows.dolly, windows.orbit].map((w) => w.start + w.duration);
      expect(Math.max(...ends)).toBeCloseTo(duration);
      expect(windows.flashUp.start + windows.flashUp.duration).toBeGreaterThan(duration - 0.01);
    }
    // Art direction: power3/expo inOut for the main flights.
    expect(FLIGHT_PROFILES.dive.dolly.ease).toBe('expo.inOut');
    expect(FLIGHT_PROFILES.surface.dolly.ease).toBe('power3.inOut');
    expect(FLIGHT_PROFILES.dive.flash).toBeGreaterThan(0);
    expect(FLIGHT_PROFILES.local.punchDeg).toBe(0);
  });

  it('quantizes the published progress', () => {
    expect(quantizeProgress(0.123456)).toBe(0.12);
    expect(quantizeProgress(-1)).toBe(0);
    expect(quantizeProgress(1.4)).toBe(1);
  });
});

describe('idleSway', () => {
  it('starts at rest, stays within the amplitude and ramps in smoothly', () => {
    expect(idleSway(0, 0.3, 60, 4)).toBe(0);
    const early = Math.abs(idleSway(0.05, 0.3, 60, 4));
    expect(early).toBeLessThan(1e-4);
    for (let t = 0; t < 200; t += 0.7) {
      expect(Math.abs(idleSway(t, 0.3, 60, 4))).toBeLessThanOrEqual(0.3 + 1e-9);
    }
    expect(idleSway(15, 0.3, 60, 4)).toBeCloseTo(0.3, 6);
  });
});
