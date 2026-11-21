import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { CAMERA } from '../config';
import type { SceneManifest, Vec3 } from '../types';
import { planetReach, planetWorldPosition } from '../system/planet-math';
import { buildUniverseModel } from '../universe/model';
import {
  FULL_FRAME,
  MIN_FRAME_FRACTION,
  computeCameraGoal,
  controlLimits,
  fitDistance,
  fovForAspect,
  frameAspect,
  frameCenter,
  frameTangents,
  overviewGoal,
  minCoreDiameterPx,
  resolveSafeFrame,
  selectionGoal,
  usesPortraitOverview,
  viewOffsetForCenter,
  type CameraGoal,
  type SafeFrame,
} from './goals';

const manifest: SceneManifest = {
  labels: { portfolio: 'Portfolio', configurator: 'Configurator', comingSoon: 'Coming soon' },
  categories: getCategories().map((category) => ({
    id: category.id,
    label: category.id,
    dna: category.dna,
    services: category.services.map((service) => ({
      slug: service.slug,
      label: service.slug,
      planet: service.planet,
    })),
  })),
  projects: [{ slug: 'demo', label: 'Demo', categories: ['web'] }],
};
const model = buildUniverseModel(manifest);
const DESKTOP = 16 / 9;
const PHONE = 390 / 844;

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** True when `point` lies inside the goal camera's frustum. */
function projectsInside(goal: CameraGoal, point: Vec3, aspect: number): boolean {
  const f = normalize([
    goal.lookAt[0] - goal.position[0],
    goal.lookAt[1] - goal.position[1],
    goal.lookAt[2] - goal.position[2],
  ]);
  const r = normalize([-f[2], 0, f[0]]);
  const u: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const rel: Vec3 = [
    point[0] - goal.position[0],
    point[1] - goal.position[1],
    point[2] - goal.position[2],
  ];
  const z = rel[0] * f[0] + rel[1] * f[1] + rel[2] * f[2];
  const x = rel[0] * r[0] + rel[1] * r[1] + rel[2] * r[2];
  const y = rel[0] * u[0] + rel[1] * u[1] + rel[2] * u[2];
  const tanV = Math.tan((goal.fov * Math.PI) / 360);
  return z > 0 && Math.abs(y / z) <= tanV && Math.abs(x / z) <= tanV * aspect;
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

describe('fovForAspect / fitDistance', () => {
  it('keeps the base FOV on landscape and widens it on portrait', () => {
    expect(fovForAspect(DESKTOP)).toBe(CAMERA.fov);
    expect(fovForAspect(PHONE)).toBeGreaterThan(CAMERA.fov);
    expect(fovForAspect(PHONE)).toBeLessThanOrEqual(CAMERA.portraitFov);
    expect(fovForAspect(0)).toBe(CAMERA.fov);
  });

  it('fits a box inside the frustum', () => {
    const d = fitDistance(10, 5, 50, 2);
    const tanV = Math.tan((50 * Math.PI) / 360);
    expect(5 / d).toBeLessThanOrEqual(tanV + 1e-9);
    expect(10 / d).toBeLessThanOrEqual(tanV * 2 + 1e-9);
  });
});

describe('computeCameraGoal', () => {
  it('frames the whole ring in the universe overview', () => {
    const goal = computeCameraGoal({ mode: 'universe' }, model, DESKTOP);
    expect(goal).toEqual(overviewGoal(model, DESKTOP));
    expect(dist(goal.position, goal.lookAt)).toBeGreaterThanOrEqual(18);
    // Every node projects inside the frustum.
    for (const node of model.nodes) expect(projectsInside(goal, node.position, DESKTOP)).toBe(true);
    // A phone needs a wider FOV to keep the ring visible.
    const phone = computeCameraGoal({ mode: 'universe' }, model, PHONE);
    expect(phone.fov).toBeGreaterThan(goal.fov);
    // On portrait the distant portfolio cluster is not forced into the frame.
    for (const node of model.nodes.filter((n) => n.kind !== 'portfolio')) {
      expect(projectsInside(phone, node.position, PHONE)).toBe(true);
    }
  });

  it('falls back to the overview for unknown targets and categories', () => {
    const overview = overviewGoal(model, DESKTOP);
    expect(computeCameraGoal({ mode: 'unknown' }, model, DESKTOP)).toEqual(overview);
    expect(computeCameraGoal({ mode: 'system', category: 'nope' }, model, DESKTOP)).toEqual(
      overview,
    );
  });

  it('approaches each category node in system mode, closer in planet mode', () => {
    for (const node of model.categories) {
      const system = computeCameraGoal(
        { mode: 'system', category: node.categoryId },
        model,
        DESKTOP,
      );
      expect(system.lookAt).toEqual(node.position);
      const systemDistance = dist(system.position, node.position);
      expect(systemDistance).toBeGreaterThan(node.systemRadius);
      expect(systemDistance).toBeLessThan(12);

      const service = node.orbits[0]!.serviceSlug;
      const planet = computeCameraGoal(
        { mode: 'planet', category: node.categoryId, service },
        model,
        DESKTOP,
      );
      expect(dist(planet.position, planet.lookAt)).toBeLessThan(systemDistance);
      expect(dist(planet.lookAt, node.position)).toBeLessThan(node.systemRadius);
    }
  });

  it('uses the system view for an unknown service', () => {
    const node = model.categories[0]!;
    expect(
      computeCameraGoal(
        { mode: 'planet', category: node.categoryId, service: 'nope' },
        model,
        DESKTOP,
      ),
    ).toEqual(computeCameraGoal({ mode: 'system', category: node.categoryId }, model, DESKTOP));
  });

  it('heads to the portfolio cluster and the configurator beacon', () => {
    const portfolio = computeCameraGoal({ mode: 'portfolio' }, model, DESKTOP);
    // The archive wall stands in front of the cluster centre.
    expect(dist(portfolio.lookAt, model.portfolio.position)).toBeLessThan(2);
    const project = computeCameraGoal({ mode: 'project', project: 'demo' }, model, DESKTOP);
    expect(dist(project.position, model.portfolio.position)).toBeLessThan(
      dist(portfolio.position, model.portfolio.position),
    );
    const configurator = computeCameraGoal({ mode: 'configurator' }, model, DESKTOP);
    expect(configurator.lookAt).toEqual(model.configurator.position);
  });

  it('keeps every goal inside the far plane with room for the star layers', () => {
    const targets = [
      { mode: 'universe' as const },
      { mode: 'portfolio' as const },
      { mode: 'configurator' as const },
    ];
    for (const target of targets) {
      for (const aspect of [DESKTOP, PHONE]) {
        const goal = computeCameraGoal(target, model, aspect);
        expect(Math.hypot(...goal.position)).toBeLessThan(CAMERA.far / 4);
      }
    }
  });
});

/* ------------------------------------------------------------------------ */
/* Safe-area framing (D28)                                                   */
/* ------------------------------------------------------------------------ */

interface Viewport {
  width: number;
  height: number;
}
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DESKTOP_VIEW: Viewport = { width: 1440, height: 900 };
const PHONE_VIEW: Viewport = { width: 390, height: 844 };
/** Typical rects published by the UI (orchestrator brief for M1 cycle 1). */
const DESKTOP_HOME_RECT: Rect = { x: 550, y: 110, width: 770, height: 460 };
const DESKTOP_PANEL_RECT: Rect = { x: 0, y: 72, width: 960, height: 828 };
const PHONE_HOME_RECT: Rect = { x: 0, y: 76, width: 390, height: 330 };
const PHONE_SHEET_RECT: Rect = { x: 0, y: 64, width: 390, height: 300 };

/**
 * Projects a world point the way the rig renders it: camera at the goal,
 * looking at `lookAt` (up = +Y), principal point moved to the frame centre.
 * Returns CSS px in the viewport and the projected radius (px) of a sphere.
 */
function projectPx(goal: CameraGoal, point: Vec3, view: Viewport, frame: SafeFrame, radius = 0) {
  const f = normalize([
    goal.lookAt[0] - goal.position[0],
    goal.lookAt[1] - goal.position[1],
    goal.lookAt[2] - goal.position[2],
  ]);
  const r = normalize([-f[2], 0, f[0]]);
  const u: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const rel: Vec3 = [
    point[0] - goal.position[0],
    point[1] - goal.position[1],
    point[2] - goal.position[2],
  ];
  const z = rel[0] * f[0] + rel[1] * f[1] + rel[2] * f[2];
  const x = rel[0] * r[0] + rel[1] * r[1] + rel[2] * r[2];
  const y = rel[0] * u[0] + rel[1] * u[1] + rel[2] * u[2];
  const tan = Math.tan((goal.fov * Math.PI) / 360);
  const aspect = view.width / view.height;
  const center = frameCenter(frame);
  return {
    x: center.x * view.width + (x / z / (tan * aspect)) * (view.width / 2),
    y: center.y * view.height - (y / z / tan) * (view.height / 2),
    r: (radius / z / tan) * (view.height / 2),
    z,
  };
}

/** True when the projected sphere lies entirely inside the rect (1 px tolerance). */
function sphereInRect(
  goal: CameraGoal,
  point: Vec3,
  radius: number,
  view: Viewport,
  frame: SafeFrame,
  rect: Rect,
): boolean {
  const p = projectPx(goal, point, view, frame, radius);
  return (
    p.z > 0 &&
    p.x - p.r >= rect.x - 1 &&
    p.x + p.r <= rect.x + rect.width + 1 &&
    p.y - p.r >= rect.y - 1 &&
    p.y + p.r <= rect.y + rect.height + 1
  );
}

function goalFor(target: Parameters<typeof computeCameraGoal>[0], view: Viewport, rect: Rect) {
  const frame = resolveSafeFrame(rect, view.width, view.height);
  return { goal: computeCameraGoal(target, model, view.width / view.height, frame), frame };
}

describe('resolveSafeFrame', () => {
  it('treats a missing or invalid rect as the whole viewport', () => {
    expect(resolveSafeFrame(null, 1440, 900)).toEqual(FULL_FRAME);
    expect(resolveSafeFrame(undefined, 1440, 900)).toEqual(FULL_FRAME);
    expect(resolveSafeFrame({ x: 0, y: 0, width: 0, height: 100 }, 1440, 900)).toEqual(FULL_FRAME);
    expect(resolveSafeFrame({ x: NaN, y: 0, width: 10, height: 10 }, 1440, 900)).toEqual(
      FULL_FRAME,
    );
    expect(resolveSafeFrame(DESKTOP_HOME_RECT, 0, 900)).toEqual(FULL_FRAME);
  });

  it('converts CSS px to viewport fractions', () => {
    const frame = resolveSafeFrame(DESKTOP_HOME_RECT, 1440, 900);
    expect(frame.x).toBeCloseTo(550 / 1440);
    expect(frame.y).toBeCloseTo(110 / 900);
    expect(frame.width).toBeCloseTo(770 / 1440);
    expect(frame.height).toBeCloseTo(460 / 900);
  });

  it('clamps to the viewport and keeps a minimum size around the centre', () => {
    const clamped = resolveSafeFrame({ x: -100, y: 800, width: 2000, height: 400 }, 1000, 1000);
    expect(clamped.x).toBe(0);
    expect(clamped.width).toBe(1);
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(1);
    expect(clamped.height).toBeCloseTo(MIN_FRAME_FRACTION);

    // A sliver above an expanded sheet grows to the minimum, centred where possible.
    const sliver = resolveSafeFrame({ x: 0, y: 64, width: 390, height: 40 }, 390, 844);
    expect(sliver.height).toBeCloseTo(MIN_FRAME_FRACTION);
    expect(sliver.y).toBe(0);
    const middle = resolveSafeFrame({ x: 0, y: 400, width: 390, height: 20 }, 390, 844);
    expect(middle.y + middle.height / 2).toBeCloseTo(410 / 844);
  });
});

describe('frame helpers', () => {
  it('moves the principal point to the frame centre', () => {
    expect(viewOffsetForCenter(0.5, 0.5, 1440, 900)).toEqual({ x: 0, y: 0 });
    const frame = resolveSafeFrame(DESKTOP_HOME_RECT, 1440, 900);
    const center = frameCenter(frame);
    const offset = viewOffsetForCenter(center.x, center.y, 1440, 900);
    // Centre of the rect is (935, 340): the window shifts left/up by its distance from (720, 450).
    expect(offset.x).toBeCloseTo(720 - 935);
    expect(offset.y).toBeCloseTo(450 - 340);
  });

  it('fits against the frame extents only', () => {
    const frame: SafeFrame = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
    const full = frameTangents(50, 2);
    const part = frameTangents(50, 2, frame);
    expect(part.tanV).toBeCloseTo(full.tanV * 0.4);
    expect(part.tanH).toBeCloseTo(full.tanH * 0.5);
    expect(fitDistance(3, 3, 50, 2, frame)).toBeGreaterThan(fitDistance(3, 3, 50, 2));
    expect(frameAspect(2, frame)).toBeCloseTo((2 * 0.5) / 0.4);
    expect(fitDistance(3, 2, 50, 2, FULL_FRAME)).toBe(fitDistance(3, 2, 50, 2));
  });
});

describe('rect-aware framing', () => {
  it('lands the desktop home network in the free area right of the hero', () => {
    const { goal, frame } = goalFor({ mode: 'universe' }, DESKTOP_VIEW, DESKTOP_HOME_RECT);
    expect(goal).toEqual(overviewGoal(model, 1440 / 900, frame));
    for (const node of model.categories) {
      expect(
        sphereInRect(
          goal,
          node.position,
          node.systemRadius,
          DESKTOP_VIEW,
          frame,
          DESKTOP_HOME_RECT,
        ),
      ).toBe(true);
    }
    for (const anchor of [model.portfolio, model.configurator]) {
      expect(sphereInRect(goal, anchor.position, 1, DESKTOP_VIEW, frame, DESKTOP_HOME_RECT)).toBe(
        true,
      );
    }
    // The fitted network spans most of the rect instead of hugging its centre.
    const xs = model.nodes.map((node) => projectPx(goal, node.position, DESKTOP_VIEW, frame).x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(DESKTOP_HOME_RECT.width * 0.6);
  });

  it('fits all categories, the beacon and the portfolio above the hero on a phone', () => {
    const { goal, frame } = goalFor({ mode: 'universe' }, PHONE_VIEW, PHONE_HOME_RECT);
    for (const node of model.nodes) {
      const radius = node.kind === 'category' ? node.systemRadius : 1;
      expect(sphereInRect(goal, node.position, radius, PHONE_VIEW, frame, PHONE_HOME_RECT)).toBe(
        true,
      );
    }
    // The free band is landscape-ish, so the landscape view is used (same constellation as desktop).
    const direction = (g: CameraGoal) =>
      normalize([
        g.position[0] - g.lookAt[0],
        g.position[1] - g.lookAt[1],
        g.position[2] - g.lookAt[2],
      ]);
    const desktop = goalFor({ mode: 'universe' }, DESKTOP_VIEW, DESKTOP_HOME_RECT).goal;
    direction(goal).forEach((value, axis) =>
      expect(value).toBeCloseTo(direction(desktop)[axis]!, 6),
    );
  });

  it('frames each system inside the free area: desktop panel and phone sheet', () => {
    for (const [view, rect] of [
      [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
      [PHONE_VIEW, PHONE_SHEET_RECT],
    ] as const) {
      for (const node of model.categories) {
        const { goal, frame } = goalFor({ mode: 'system', category: node.categoryId }, view, rect);
        expect(goal.lookAt).toEqual(node.position);
        // The focus lands on the rect centre…
        const center = projectPx(goal, node.position, view, frame);
        expect(center.x).toBeCloseTo(rect.x + rect.width / 2, 6);
        expect(center.y).toBeCloseTo(rect.y + rect.height / 2, 6);
        // …and the whole system (orbits included) stays inside the rect.
        expect(sphereInRect(goal, node.position, node.systemRadius, view, frame, rect)).toBe(true);
        // A smaller free area moves the camera back compared to the full viewport.
        const full = computeCameraGoal(
          { mode: 'system', category: node.categoryId },
          model,
          view.width / view.height,
        );
        expect(dist(goal.position, goal.lookAt)).toBeGreaterThan(dist(full.position, full.lookAt));
      }
    }
  });

  it('keeps the phone system above the sheet', () => {
    const node = model.categories[0]!;
    const { goal, frame } = goalFor(
      { mode: 'system', category: node.categoryId },
      PHONE_VIEW,
      PHONE_SHEET_RECT,
    );
    const p = projectPx(goal, node.position, PHONE_VIEW, frame, node.systemRadius);
    expect(p.y + p.r).toBeLessThanOrEqual(PHONE_SHEET_RECT.y + PHONE_SHEET_RECT.height);
  });

  it('centres planets, portfolio, projects and the beacon in the free area', () => {
    const node = model.categories[1]!;
    const targets = [
      { mode: 'planet' as const, category: node.categoryId, service: node.orbits[0]!.serviceSlug },
      { mode: 'portfolio' as const },
      { mode: 'project' as const, project: 'demo' },
      { mode: 'configurator' as const },
    ];
    for (const [view, rect] of [
      [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
      [PHONE_VIEW, PHONE_SHEET_RECT],
    ] as const) {
      for (const target of targets) {
        const { goal, frame } = goalFor(target, view, rect);
        const p = projectPx(goal, goal.lookAt, view, frame);
        expect(p.x).toBeCloseTo(rect.x + rect.width / 2, 6);
        expect(p.y).toBeCloseTo(rect.y + rect.height / 2, 6);
      }
      const { goal, frame } = goalFor({ mode: 'configurator' }, view, rect);
      expect(sphereInRect(goal, model.configurator.position, 1.8, view, frame, rect)).toBe(true);
    }
  });

  it('matches the full-viewport framing when the rect covers everything', () => {
    for (const target of [
      { mode: 'universe' as const },
      { mode: 'system' as const, category: model.categories[2]!.categoryId },
      { mode: 'configurator' as const },
    ]) {
      const { goal } = goalFor(target, DESKTOP_VIEW, { x: 0, y: 0, width: 1440, height: 900 });
      const full = computeCameraGoal(target, model, 1440 / 900);
      goal.position.forEach((value, axis) => expect(value).toBeCloseTo(full.position[axis]!, 9));
      expect(goal.lookAt).toEqual(full.lookAt);
    }
  });
});

describe('controlLimits', () => {
  it('keeps zoom relative to the fitted distance and the pivot in view', () => {
    const overview = controlLimits({ mode: 'universe' }, 40, 1.1);
    expect(overview.minDistance).toBeCloseTo(24);
    expect(overview.maxDistance).toBeCloseTo(56);
    expect(overview.minPolar).toBeGreaterThanOrEqual(0.35);
    // Never below the ring plane by more than a few degrees.
    expect(overview.maxPolar).toBeLessThanOrEqual(Math.PI / 2 + 0.18 + 1e-9);
    expect(overview.minPolar).toBeLessThanOrEqual(1.1);
    expect(overview.maxPolar).toBeGreaterThanOrEqual(1.1);

    const system = controlLimits({ mode: 'system', category: 'web' }, 4, 1.2);
    expect(system.minDistance).toBeCloseTo(2);
    expect(system.maxDistance).toBeCloseTo(7.6);
    for (const target of [
      { mode: 'portfolio' as const },
      { mode: 'configurator' as const },
      { mode: 'planet' as const, category: 'web', service: 'x' },
    ]) {
      const limits = controlLimits(target, 10, 1.2);
      expect(limits.minDistance).toBeLessThan(10);
      expect(limits.maxDistance).toBeGreaterThan(10);
      expect(limits.minPolar).toBeLessThanOrEqual(1.2);
      expect(limits.maxPolar).toBeGreaterThanOrEqual(1.2);
    }
  });
});

describe('overview layout choice and sway (V2-01, V2-08)', () => {
  const VIEW_1536: Viewport = { width: 1536, height: 864 };
  /** Free column between hero and index at 1536×864 (visual review V2-01). */
  const COLUMN_RECT: Rect = { x: 0, y: 68, width: 626, height: 796 };

  it('fits the landscape layout into a portrait-ish free rect, portfolio included', () => {
    const frame = resolveSafeFrame(COLUMN_RECT, VIEW_1536.width, VIEW_1536.height);
    expect(usesPortraitOverview(VIEW_1536.width / VIEW_1536.height, frame)).toBe(false);
    const goal = computeCameraGoal(
      { mode: 'universe' },
      model,
      VIEW_1536.width / VIEW_1536.height,
      frame,
    );
    for (const node of model.nodes) {
      const radius = node.kind === 'category' ? node.systemRadius : 1;
      expect(sphereInRect(goal, node.position, radius, VIEW_1536, frame, COLUMN_RECT)).toBe(true);
    }
  });

  it('keeps the portrait layout for a free viewport (D26) and for very narrow rects', () => {
    expect(usesPortraitOverview(390 / 844, FULL_FRAME)).toBe(true);
    const narrow = resolveSafeFrame({ x: 0, y: 0, width: 300, height: 800 }, 1440, 900);
    expect(usesPortraitOverview(1440 / 900, narrow)).toBe(true);
    expect(usesPortraitOverview(1440 / 900, FULL_FRAME)).toBe(false);
  });

  it('fits the overview over the idle sway range', () => {
    const { frame } = goalFor({ mode: 'universe' }, DESKTOP_VIEW, DESKTOP_HOME_RECT);
    const aspect = DESKTOP_VIEW.width / DESKTOP_VIEW.height;
    const sway = 0.2;
    const still = computeCameraGoal({ mode: 'universe' }, model, aspect, frame);
    const swaying = computeCameraGoal({ mode: 'universe' }, model, aspect, frame, { sway });
    expect(dist(swaying.position, swaying.lookAt)).toBeGreaterThan(
      dist(still.position, still.lookAt),
    );
    // At either end of the sway every node is still inside the rect.
    for (const angle of [-sway, sway]) {
      const position = rotateAround(swaying.position, swaying.lookAt, angle);
      const goal = { ...swaying, position };
      for (const node of model.categories) {
        expect(
          sphereInRect(
            goal,
            node.position,
            node.systemRadius,
            DESKTOP_VIEW,
            frame,
            DESKTOP_HOME_RECT,
          ),
        ).toBe(true);
      }
    }
  });

  it('gives desktop cores an 18 px floor (V2-02)', () => {
    expect(minCoreDiameterPx(750, 305)).toBeCloseTo(15.25);
    expect(minCoreDiameterPx(750, 305, true)).toBe(18);
    expect(minCoreDiameterPx(824, 564, true)).toBeCloseTo(28.2);
  });
});

function rotateAround(point: Vec3, center: Vec3, angle: number): Vec3 {
  const dx = point[0] - center[0];
  const dz = point[2] - center[2];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [center[0] + dx * c + dz * s, point[1], center[2] - dx * s + dz * c];
}

describe('planet focus framing', () => {
  const node = model.categories[2]!;
  const orbit = node.orbits[1]!;
  const target = { mode: 'planet' as const, category: node.categoryId, service: orbit.serviceSlug };

  it('looks at the live planet and fits it with rings and moons inside the free rect', () => {
    for (const [view, rect] of [
      [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
      [PHONE_VIEW, PHONE_SHEET_RECT],
    ] as const) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      for (const angle of [0, 1.3, 4.1]) {
        const goal = computeCameraGoal(target, model, view.width / view.height, frame, {
          planetAngle: angle,
        });
        const planet = planetWorldPosition(node.position, orbit, angle);
        goal.lookAt.forEach((value, axis) => expect(value).toBeCloseTo(planet[axis]!, 9));
        const p = projectPx(goal, planet, view, frame);
        expect(p.x).toBeCloseTo(rect.x + rect.width / 2, 6);
        expect(p.y).toBeCloseTo(rect.y + rect.height / 2, 6);
        expect(sphereInRect(goal, planet, planetReach(orbit), view, frame, rect)).toBe(true);
        // The camera stays outside the planet's reach and closer than the system view.
        expect(dist(goal.position, planet)).toBeGreaterThan(planetReach(orbit) * 2);
        const system = computeCameraGoal(
          { mode: 'system', category: node.categoryId },
          model,
          view.width / view.height,
          frame,
        );
        expect(dist(goal.position, goal.lookAt)).toBeLessThan(dist(system.position, system.lookAt));
      }
    }
  });

  it('starts deep links at the orbit phase', () => {
    const frame = resolveSafeFrame(DESKTOP_PANEL_RECT, DESKTOP_VIEW.width, DESKTOP_VIEW.height);
    const aspect = DESKTOP_VIEW.width / DESKTOP_VIEW.height;
    expect(computeCameraGoal(target, model, aspect, frame)).toEqual(
      computeCameraGoal(target, model, aspect, frame, { planetAngle: orbit.phase }),
    );
  });
});

describe('configurator selection framing (D81)', () => {
  const configurator = { mode: 'configurator' as const };
  const key = (id: string) => `category:${id}`;
  const views = [
    [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
    [PHONE_VIEW, PHONE_SHEET_RECT],
  ] as const;
  const selections = [
    ['crm'],
    ['web', 'crm'],
    ['ai', 'telegram'],
    model.categories.map((node) => node.categoryId),
  ];

  it('keeps the plain beacon focus without a selection, and ignores it elsewhere', () => {
    const frame = resolveSafeFrame(DESKTOP_PANEL_RECT, DESKTOP_VIEW.width, DESKTOP_VIEW.height);
    const aspect = DESKTOP_VIEW.width / DESKTOP_VIEW.height;
    const plain = computeCameraGoal(configurator, model, aspect, frame);
    expect(computeCameraGoal(configurator, model, aspect, frame, { emphasis: [] })).toEqual(plain);
    // Unknown ids and the beacon itself do not count as a selection.
    expect(
      computeCameraGoal(configurator, model, aspect, frame, {
        emphasis: ['category:nope', 'configurator'],
      }),
    ).toEqual(plain);
    for (const target of [
      { mode: 'universe' as const },
      { mode: 'system' as const, category: 'web' },
      { mode: 'portfolio' as const },
    ]) {
      expect(
        computeCameraGoal(target, model, aspect, frame, { emphasis: [key('web'), key('ai')] }),
      ).toEqual(computeCameraGoal(target, model, aspect, frame));
    }
  });

  it('fits the beacon and every selected category into the free rect', () => {
    for (const [view, rect] of views) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      const aspect = view.width / view.height;
      // The beacon focus approaches from the overview, which depends on the sway.
      const plain = computeCameraGoal(configurator, model, aspect, frame, { sway: 0.2 });
      const overview = computeCameraGoal({ mode: 'universe' }, model, aspect, frame, { sway: 0.2 });
      for (const ids of selections) {
        const goal = computeCameraGoal(configurator, model, aspect, frame, {
          emphasis: ids.map(key),
          sway: 0.2,
        });
        expect(sphereInRect(goal, model.configurator.position, 1.2, view, frame, rect)).toBe(true);
        for (const id of ids) {
          const node = model.byKey.get(key(id))!;
          expect(sphereInRect(goal, node.position, 1, view, frame, rect)).toBe(true);
        }
        // Never closer than the beacon focus, never wider than the overview.
        const distance = dist(goal.position, goal.lookAt);
        expect(distance).toBeGreaterThanOrEqual(dist(plain.position, plain.lookAt) - 1e-9);
        expect(distance).toBeLessThanOrEqual(dist(overview.position, overview.lookAt) + 1e-9);
        // Same viewing direction as the beacon focus: a dolly out, not a swing around.
        const direction = (g: CameraGoal) =>
          normalize([
            g.position[0] - g.lookAt[0],
            g.position[1] - g.lookAt[1],
            g.position[2] - g.lookAt[2],
          ]);
        direction(goal).forEach((value, axis) =>
          expect(value).toBeCloseTo(direction(plain)[axis]!, 9),
        );
      }
    }
  });

  it('keeps the beacon and the nearest selected nodes when not all of them fit', () => {
    const [view, rect] = views[1];
    const frame = resolveSafeFrame(rect, view.width, view.height);
    const aspect = view.width / view.height;
    const focus = computeCameraGoal(configurator, model, aspect, frame);
    const focusDistance = dist(focus.position, focus.lookAt);
    const crm = model.byKey.get(key('crm'))!;
    const telegram = model.byKey.get(key('telegram'))!;
    const crmOnly = selectionGoal(model, focus, [crm], aspect, frame, Infinity);
    const cap = dist(crmOnly.position, crmOnly.lookAt) + 0.5;
    // CRM is the nearest category to the beacon; Telegram is across the ring.
    const goal = selectionGoal(model, focus, [telegram, crm], aspect, frame, cap);
    expect(goal).toEqual(crmOnly);
    expect(sphereInRect(goal, model.configurator.position, 1.2, view, frame, rect)).toBe(true);
    expect(sphereInRect(goal, crm.position, 1, view, frame, rect)).toBe(true);
    // Nothing fits under the cap: the plain beacon focus.
    expect(selectionGoal(model, focus, [telegram], aspect, frame, focusDistance)).toEqual(focus);
  });
});
