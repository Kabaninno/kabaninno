import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { CAMERA } from '../config';
import type { SceneManifest, Vec3 } from '../types';
import { COMET_TAIL_CAPSULE, CORE_CORONA_RADIUS } from '../system/constants';
import { PLANET_SHAPES } from '../system/planet-geometry';
import {
  MAX_PLANET_BOOST,
  MIN_PLANET_DIAMETER_PX,
  planetReach,
  planetScreenBoost,
  planetWorldPosition,
} from '../system/planet-math';
import { buildUniverseModel } from '../universe/model';
import {
  FULL_FRAME,
  MIN_FRAME_FRACTION,
  centreOnPoint,
  computeCameraGoal,
  configuratorDistanceFactor,
  freeAreaCenter,
  configuratorLinkCount,
  CONFIGURATOR_DOLLY,
  controlLimits,
  fitDistance,
  fovForAspect,
  frameAspect,
  frameCenter,
  frameTangents,
  orbitPreviewRadiusPx,
  overviewGoal,
  overviewSwayAmplitude,
  tallElevation,
  systemGoal,
  usesTallOverview,
  OVERVIEW,
  PHONE_CORE_BOOST,
  minCoreDiameterPx,
  CORE_KEEP_OUT,
  PLANET_VIEW,
  orbitTangent,
  SYSTEM_FIT,
  resolveSafeFrame,
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
    // The beacon crystal is the look target: the centre of the frame (owner round 3, part C).
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
/** Configurator on a phone with the sheet expanded: a thin band under the HUD (round 3, C). */
const PHONE_BAND_RECT: Rect = { x: 0, y: 68, width: 390, height: 33 };

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

function goalFor(
  target: Parameters<typeof computeCameraGoal>[0],
  view: Viewport,
  rect: Rect,
  viewport?: Viewport,
) {
  const frame = resolveSafeFrame(rect, view.width, view.height);
  return {
    goal: computeCameraGoal(target, model, view.width / view.height, frame, { viewport }),
    frame,
  };
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
    // The free area is nearly square, so the tall phone view is used (B1): the same
    // constellation as the desktop's, seen from higher up and more head-on.
    const elevation = (g: CameraGoal) =>
      Math.asin(
        normalize([
          g.position[0] - g.lookAt[0],
          g.position[1] - g.lookAt[1],
          g.position[2] - g.lookAt[2],
        ])[1],
      );
    const desktop = goalFor({ mode: 'universe' }, DESKTOP_VIEW, DESKTOP_HOME_RECT).goal;
    expect(elevation(goal)).toBeGreaterThan(elevation(desktop) + 0.2);
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

/* ------------------------------------------------------------------------ */
/* Phone home: the tall overview (B1)                                        */
/* ------------------------------------------------------------------------ */

describe('tall phone overview (B1)', () => {
  /** Free areas published on phones: the band between the HUD and the hero block. */
  const PHONES: Array<{ name: string; view: Viewport; rect: Rect }> = [
    {
      name: '360×740',
      view: { width: 360, height: 740 },
      rect: { x: 0, y: 68, width: 360, height: 273 },
    },
    { name: '390×844', view: PHONE_VIEW, rect: { x: 0, y: 68, width: 390, height: 423 } },
    {
      name: '412×915',
      view: { width: 412, height: 915 },
      rect: { x: 0, y: 68, width: 412, height: 450 },
    },
  ];

  /**
   * On-screen extent of the network: every node with the radius it is drawn at (cores at
   * the phone minimum, category orbit previews widened to clear them, see CategoryNode).
   */
  function networkExtent(view: Viewport, rect: Rect) {
    const { goal, frame } = goalFor({ mode: 'universe' }, view, rect, view);
    const minCore = minCoreDiameterPx(
      frame.width * view.width,
      frame.height * view.height,
      false,
      PHONE_CORE_BOOST,
    );
    const spheres = model.nodes.map((node) => {
      const p = projectPx(goal, node.position, view, frame);
      const radius =
        node.kind === 'category'
          ? orbitPreviewRadiusPx(node, minCore)
          : node.kind === 'portfolio'
            ? minCore * 1.3
            : minCore * 1.15;
      return { x: p.x, y: p.y, r: radius };
    });
    return {
      top: Math.min(...spheres.map((p) => p.y - p.r)),
      bottom: Math.max(...spheres.map((p) => p.y + p.r)),
      left: Math.min(...spheres.map((p) => p.x - p.r)),
      right: Math.max(...spheres.map((p) => p.x + p.r)),
    };
  }

  it.each(PHONES)('uses the tall view and fills the free height on $name', ({ view, rect }) => {
    const aspect = view.width / view.height;
    const frame = resolveSafeFrame(rect, view.width, view.height);
    expect(usesTallOverview(aspect, frame)).toBe(true);
    expect(usesPortraitOverview(aspect, frame)).toBe(false);
    const extent = networkExtent(view, rect);
    // At least 90 % of the free height is covered, nothing leaves the free rect.
    expect((extent.bottom - extent.top) / rect.height).toBeGreaterThanOrEqual(0.9);
    expect(extent.top).toBeGreaterThanOrEqual(rect.y - 4);
    expect(extent.bottom).toBeLessThanOrEqual(rect.y + rect.height + 4);
    // Nothing is clipped by the viewport edges either (orbit previews included).
    expect(extent.left).toBeGreaterThanOrEqual(0);
    expect(extent.right).toBeLessThanOrEqual(view.width);
  });

  it('beats the landscape view on the same phone frame by a wide margin', () => {
    const view = PHONE_VIEW;
    const rect = PHONES[1]!.rect;
    const frame = resolveSafeFrame(rect, view.width, view.height);
    const aspect = view.width / view.height;
    const tall = overviewGoal(model, aspect, frame, 0.2);
    const landscape = overviewGoal(model, aspect, frame, 0.2, { layout: 'legacy' });
    const spread = (goal: CameraGoal) => {
      const ys = model.nodes.map((n) => projectPx(goal, n.position, view, frame).y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(spread(tall)).toBeGreaterThan(spread(landscape) * 1.6);
    // Closer, too: the nodes get larger on screen.
    expect(dist(tall.position, tall.lookAt)).toBeLessThan(
      dist(landscape.position, landscape.lookAt),
    );
  });

  it('keeps every node inside the rect over the idle sway of the tall view', () => {
    const view = PHONE_VIEW;
    const rect = PHONES[1]!.rect;
    const { frame } = goalFor({ mode: 'universe' }, view, rect);
    const aspect = view.width / view.height;
    const sway = 0.2;
    const goal = computeCameraGoal({ mode: 'universe' }, model, aspect, frame, { sway });
    const amplitude = overviewSwayAmplitude(aspect, frame, sway);
    for (const angle of [-amplitude, amplitude]) {
      const swung = { ...goal, position: rotateAround(goal.position, goal.lookAt, angle) };
      for (const node of model.categories) {
        expect(sphereInRect(swung, node.position, node.systemRadius, view, frame, rect)).toBe(true);
      }
    }
  });

  it('leaves the desktop, wide bands, narrow columns and the full viewport alone', () => {
    const desktopFrame = goalFor({ mode: 'universe' }, DESKTOP_VIEW, DESKTOP_HOME_RECT).frame;
    expect(usesTallOverview(DESKTOP_VIEW.width / DESKTOP_VIEW.height, desktopFrame)).toBe(false);
    const desktopAspect = DESKTOP_VIEW.width / DESKTOP_VIEW.height;
    expect(overviewGoal(model, desktopAspect, desktopFrame)).toEqual(
      overviewGoal(model, desktopAspect, desktopFrame, 0, { layout: 'legacy' }),
    );
    // A short band above a tall hero (shape > 1.45) and the whole viewport stay as before.
    const band = resolveSafeFrame({ x: 0, y: 68, width: 375, height: 246 }, 375, 667);
    expect(usesTallOverview(375 / 667, band)).toBe(false);
    expect(usesTallOverview(390 / 844, FULL_FRAME)).toBe(false);
    const column = resolveSafeFrame({ x: 0, y: 0, width: 300, height: 800 }, 390, 844);
    expect(usesTallOverview(390 / 844, column)).toBe(false);
    // Landscape phones (wide viewport) never use it.
    const sideways = resolveSafeFrame({ x: 0, y: 60, width: 844, height: 280 }, 844, 390);
    expect(usesTallOverview(844 / 390, sideways)).toBe(false);
  });

  it('looks from higher up at taller frames, within its limits', () => {
    expect(tallElevation(0.8)).toBeGreaterThan(tallElevation(1.2));
    expect(tallElevation(0.01)).toBeLessThanOrEqual(OVERVIEW.tall.maxElevation);
    expect(tallElevation(5)).toBeGreaterThanOrEqual(OVERVIEW.tall.minElevation);
  });

  it('approaches systems, the archive and the beacon as before (landscape overview side)', () => {
    const view = PHONE_VIEW;
    const rect = PHONES[1]!.rect;
    const { frame } = goalFor({ mode: 'universe' }, view, rect);
    const aspect = view.width / view.height;
    const legacy = overviewGoal(model, aspect, frame, 0.2, { layout: 'legacy' });
    const node = model.categories[0]!;
    const goal = computeCameraGoal(
      { mode: 'system', category: node.categoryId },
      model,
      aspect,
      frame,
      { sway: 0.2 },
    );
    expect(goal).toEqual(systemGoal(node, legacy.position, legacy.fov, aspect, frame));
  });

  it('shrinks the idle sway in the tall view only', () => {
    const view = PHONE_VIEW;
    const { frame } = goalFor({ mode: 'universe' }, view, PHONES[1]!.rect);
    expect(overviewSwayAmplitude(view.width / view.height, frame, 0.2)).toBeLessThan(0.2);
    const desktopFrame = goalFor({ mode: 'universe' }, DESKTOP_VIEW, DESKTOP_HOME_RECT).frame;
    expect(overviewSwayAmplitude(DESKTOP_VIEW.width / DESKTOP_VIEW.height, desktopFrame, 0.2)).toBe(
      0.2,
    );
  });

  it('makes phone cores larger without touching the desktop floor', () => {
    expect(minCoreDiameterPx(390, 423, false, PHONE_CORE_BOOST)).toBeCloseTo(
      minCoreDiameterPx(390, 423) * PHONE_CORE_BOOST,
    );
    expect(minCoreDiameterPx(390, 423)).toBeCloseTo(19.5);
    expect(minCoreDiameterPx(824, 564, true)).toBeCloseTo(28.2);
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

describe('configurator framing (owner round 3, part C)', () => {
  const configurator = { mode: 'configurator' as const };
  const key = (id: string) => `category:${id}`;
  const views = [
    [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
    [
      { width: 1920, height: 1080 },
      { x: 0, y: 72, width: 1280, height: 1008 },
    ],
    [
      { width: 1366, height: 768 },
      { x: 0, y: 64, width: 846, height: 704 },
    ],
    [PHONE_VIEW, PHONE_SHEET_RECT],
    // Expanded sheet: a 33 px band under the HUD, smaller than MIN_FRAME_FRACTION.
    [PHONE_VIEW, PHONE_BAND_RECT],
  ] as const;
  const ids = model.categories.map((node) => node.categoryId);
  /** 0–3 selected categories, plus every category (the dolly stays capped). */
  const selections = [[], ids.slice(0, 1), ids.slice(0, 2), ids.slice(0, 3), ids];
  const direction = (g: CameraGoal) =>
    normalize([
      g.position[0] - g.lookAt[0],
      g.position[1] - g.lookAt[1],
      g.position[2] - g.lookAt[2],
    ]);

  it('dollies back by CONFIGURATOR_DOLLY per link, capped at 1.2', () => {
    expect(configuratorDistanceFactor(0)).toBe(1);
    expect(configuratorDistanceFactor(1)).toBeCloseTo(1 + CONFIGURATOR_DOLLY.perLink, 9);
    expect(configuratorDistanceFactor(2)).toBeCloseTo(1 + 2 * CONFIGURATOR_DOLLY.perLink, 9);
    expect(configuratorDistanceFactor(3)).toBeLessThanOrEqual(1.2);
    expect(configuratorDistanceFactor(3)).toBeGreaterThan(configuratorDistanceFactor(2));
    for (const links of [4, 5, 12, 100]) expect(configuratorDistanceFactor(links)).toBe(1.2);
    expect(CONFIGURATOR_DOLLY.max).toBe(1.2);
    // Invalid counts never move the camera.
    expect(configuratorDistanceFactor(-1)).toBe(1);
    expect(configuratorDistanceFactor(Number.NaN)).toBe(1);
    // Reduced motion: a selection never moves the camera.
    for (const links of [0, 1, 3, 9]) expect(configuratorDistanceFactor(links, true)).toBe(1);
  });

  it('finds the free band centre even when the frame was widened past it', () => {
    expect(freeAreaCenter(null, 390, 844)).toEqual({ x: 0.5, y: 0.5 });
    expect(freeAreaCenter({ x: 0, y: 0, width: 0, height: 10 }, 390, 844)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    // A rect larger than the minimum frame: the same as the frame centre.
    const frame = resolveSafeFrame(DESKTOP_PANEL_RECT, DESKTOP_VIEW.width, DESKTOP_VIEW.height);
    const centre = freeAreaCenter(DESKTOP_PANEL_RECT, DESKTOP_VIEW.width, DESKTOP_VIEW.height);
    expect(centre.x).toBeCloseTo(frameCenter(frame).x, 12);
    expect(centre.y).toBeCloseTo(frameCenter(frame).y, 12);
    // The 33 px band: the frame is widened against the top edge, the band centre is not.
    const band = freeAreaCenter(PHONE_BAND_RECT, PHONE_VIEW.width, PHONE_VIEW.height);
    const bandFrame = resolveSafeFrame(PHONE_BAND_RECT, PHONE_VIEW.width, PHONE_VIEW.height);
    expect(band.y * PHONE_VIEW.height).toBeCloseTo(68 + 33 / 2, 9);
    expect(frameCenter(bandFrame).y).toBeGreaterThan(band.y);
  });

  it('moves a goal across its view to put its target on a point, keeping direction and distance', () => {
    const aspect = PHONE_VIEW.width / PHONE_VIEW.height;
    const frame = resolveSafeFrame(PHONE_BAND_RECT, PHONE_VIEW.width, PHONE_VIEW.height);
    const goal = computeCameraGoal(configurator, model, aspect, frame);
    expect(centreOnPoint(goal, frameCenter(frame), aspect, frame)).toEqual(goal);
    const point = { x: 0.3, y: 0.1 };
    const moved = centreOnPoint(goal, point, aspect, frame);
    const p = projectPx(moved, goal.lookAt, PHONE_VIEW, frame);
    expect(p.x).toBeCloseTo(point.x * PHONE_VIEW.width, 6);
    expect(p.y).toBeCloseTo(point.y * PHONE_VIEW.height, 6);
    expect(dist(moved.position, moved.lookAt)).toBeCloseTo(dist(goal.position, goal.lookAt), 9);
    direction(moved).forEach((value, axis) => expect(value).toBeCloseTo(direction(goal)[axis]!, 9));
  });

  it('counts distinct selected categories only', () => {
    expect(configuratorLinkCount(model, undefined)).toBe(0);
    expect(configuratorLinkCount(model, [])).toBe(0);
    expect(configuratorLinkCount(model, ['category:nope', 'configurator', 'portfolio'])).toBe(0);
    expect(configuratorLinkCount(model, [key(ids[0]!), key(ids[0]!), key(ids[1]!)])).toBe(2);
  });

  it('keeps the crystal at the centre of the free rect for 0–3 selected categories', () => {
    for (const [view, rect] of views) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      const aspect = view.width / view.height;
      // As the director passes it: the free band's own centre.
      const freeCenter = freeAreaCenter(rect, view.width, view.height);
      const widened = rect.height / view.height < MIN_FRAME_FRACTION;
      const plain = computeCameraGoal(configurator, model, aspect, frame, {
        sway: 0.2,
        freeCenter,
      });
      const plainDistance = dist(plain.position, plain.lookAt);
      for (const selection of selections) {
        const goal = computeCameraGoal(configurator, model, aspect, frame, {
          emphasis: selection.map(key),
          sway: 0.2,
          freeCenter,
        });
        // The crystal projects to the free rect's centre (px), whatever the selection.
        const crystal = projectPx(goal, model.configurator.position, view, frame);
        expect(crystal.x).toBeCloseTo(rect.x + rect.width / 2, 6);
        expect(crystal.y).toBeCloseTo(rect.y + rect.height / 2, 6);
        if (!widened) {
          // The frame is the rect: the crystal is the look target itself.
          expect(goal.lookAt).toEqual(model.configurator.position);
          expect(sphereInRect(goal, model.configurator.position, 1.2, view, frame, rect)).toBe(
            true,
          );
        }
        // A dolly along the same viewing direction, never toward the categories.
        direction(goal).forEach((value, axis) =>
          expect(value).toBeCloseTo(direction(plain)[axis]!, 9),
        );
        const factor = dist(goal.position, goal.lookAt) / plainDistance;
        expect(factor).toBeCloseTo(configuratorDistanceFactor(selection.length), 9);
        expect(factor).toBeGreaterThanOrEqual(1);
        expect(factor).toBeLessThanOrEqual(1.2 + 1e-9);
      }
    }
  });

  it('moves the camera back step by step as categories are added, and forth when removed', () => {
    const [view, rect] = views[0];
    const frame = resolveSafeFrame(rect, view.width, view.height);
    const aspect = view.width / view.height;
    const distanceFor = (count: number) => {
      const goal = computeCameraGoal(configurator, model, aspect, frame, {
        emphasis: ids.slice(0, count).map(key),
      });
      return dist(goal.position, goal.lookAt);
    };
    expect(distanceFor(1)).toBeGreaterThan(distanceFor(0));
    expect(distanceFor(2)).toBeGreaterThan(distanceFor(1));
    expect(distanceFor(3)).toBeGreaterThan(distanceFor(2));
    expect(distanceFor(3) / distanceFor(0)).toBeCloseTo(configuratorDistanceFactor(3), 9);
    // Removing a category brings the camera back to the framing of that count,
    // whichever categories remain.
    const afterRemoval = computeCameraGoal(configurator, model, aspect, frame, {
      emphasis: [key(ids[0]!), key(ids[2]!)],
    });
    expect(dist(afterRemoval.position, afterRemoval.lookAt)).toBeCloseTo(distanceFor(2), 9);
  });

  it('ignores the selection under reduced motion and on other routes', () => {
    for (const [view, rect] of views) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      const aspect = view.width / view.height;
      const plain = computeCameraGoal(configurator, model, aspect, frame, { sway: 0 });
      for (const selection of selections) {
        expect(
          computeCameraGoal(configurator, model, aspect, frame, {
            emphasis: selection.map(key),
            sway: 0,
            reducedMotion: true,
          }),
        ).toEqual(plain);
      }
      expect(computeCameraGoal(configurator, model, aspect, frame, { emphasis: [] })).toEqual(
        computeCameraGoal(configurator, model, aspect, frame),
      );
      for (const target of [
        { mode: 'universe' as const },
        { mode: 'system' as const, category: 'web' },
        { mode: 'portfolio' as const },
      ]) {
        expect(
          computeCameraGoal(target, model, aspect, frame, { emphasis: [key('web'), key('ai')] }),
        ).toEqual(computeCameraGoal(target, model, aspect, frame));
      }
    }
  });
});

describe('planet focus keeps the core clear (MJ1)', () => {
  it('puts the core out of frame or 1.5 planet radii clear of the planet', () => {
    for (const [view, rect] of [
      [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
      [PHONE_VIEW, PHONE_SHEET_RECT],
    ] as const) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      for (const node of model.categories) {
        for (const orbit of node.orbits) {
          for (const angle of [0, 1.3, 2.6, 4.1, 5.5]) {
            const goal = computeCameraGoal(
              { mode: 'planet', category: node.categoryId, service: orbit.serviceSlug },
              model,
              view.width / view.height,
              frame,
              { planetAngle: angle },
            );
            const planet = planetWorldPosition(node.position, orbit, angle);
            // Inner orbits cannot clear the core from any side (the core's keep-out plus
            // the planet's reach exceed the orbit radius): the core dims and shrinks there.
            const feasible =
              dist(planet, node.position) >= CORE_KEEP_OUT + planetReach(orbit) + 1.5 * orbit.size;
            if (!feasible) continue;
            const core = projectPx(goal, node.position, view, frame, CORE_KEEP_OUT);
            if (core.z <= 0) continue; // behind the camera
            const outside =
              core.x + core.r < rect.x ||
              core.x - core.r > rect.x + rect.width ||
              core.y + core.r < rect.y ||
              core.y - core.r > rect.y + rect.height;
            if (outside) continue;
            const p = projectPx(goal, planet, view, frame, planetReach(orbit));
            const body = projectPx(goal, planet, view, frame, orbit.size);
            const gap = Math.hypot(core.x - p.x, core.y - p.y) - core.r - p.r;
            expect(gap).toBeGreaterThanOrEqual(1.5 * body.r - 1);
          }
        }
      }
    }
  });
});

describe('system view fit (MJ2)', () => {
  it('spans most of the free width with every orbit inside the rect', () => {
    for (const [view, rect] of [
      [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
      [PHONE_VIEW, PHONE_SHEET_RECT],
    ] as const) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      for (const node of model.categories) {
        const { goal } = goalFor({ mode: 'system', category: node.categoryId }, view, rect);
        let minX = Infinity;
        let maxX = -Infinity;
        for (const orbit of node.orbits) {
          for (let k = 0; k < 24; k++) {
            const planet = planetWorldPosition(node.position, orbit, (k / 24) * Math.PI * 2);
            const reach = planetReach(orbit) * SYSTEM_FIT.reachMargin;
            expect(sphereInRect(goal, planet, reach, view, frame, rect)).toBe(true);
            const p = projectPx(goal, planet, view, frame);
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
          }
        }
        // Closer than the old bounding-sphere fit (phone systems were tiny).
        const radius = Math.max(node.systemRadius * 1.2, 0.8);
        const sphere = fitDistance(radius, radius, goal.fov, view.width / view.height, frame);
        // Closer on the phone band; about the same on desktop.
        const limit = view === PHONE_VIEW ? sphere * 0.95 : sphere * 1.05;
        expect(dist(goal.position, goal.lookAt)).toBeLessThan(limit);
        expect(maxX - minX).toBeGreaterThan(rect.width * 0.45);
      }
    }
  });
});

describe('planet focus invariants for every service (S1, S2)', () => {
  const views = [
    [DESKTOP_VIEW, DESKTOP_PANEL_RECT],
    [PHONE_VIEW, PHONE_SHEET_RECT],
  ] as const;

  /** Distance from a point to an orbit path (sampled), optionally skipping a window around `skip`. */
  function orbitDistance(
    point: Vec3,
    node: (typeof model.categories)[number],
    orbit: (typeof node.orbits)[number],
    skip?: number,
  ) {
    let best = Infinity;
    for (let k = 0; k < 360; k++) {
      const a = (k / 360) * Math.PI * 2;
      if (skip !== undefined) {
        const delta = Math.abs(Math.atan2(Math.sin(a - skip), Math.cos(a - skip)));
        if (delta < PLANET_VIEW.ownOrbitSkip) continue;
      }
      best = Math.min(best, dist(point, planetWorldPosition(node.position, orbit, a)));
    }
    return best;
  }

  it('keeps the camera clear of the planet, the core, every orbit and the near plane', () => {
    expect(model.categories.reduce((n, node) => n + node.orbits.length, 0)).toBe(20);
    for (const [view, rect] of views) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      for (const node of model.categories) {
        for (const orbit of node.orbits) {
          for (const angle of [orbit.phase, 0, 1.3, 2.6, 4.1, 5.5]) {
            const goal = computeCameraGoal(
              { mode: 'planet', category: node.categoryId, service: orbit.serviceSlug },
              model,
              view.width / view.height,
              frame,
              { planetAngle: angle },
            );
            const planet = planetWorldPosition(node.position, orbit, angle);
            const reach = planetReach(orbit);
            const camera = goal.position;
            const label = `${node.categoryId}/${orbit.serviceSlug} @${angle.toFixed(2)} ${view.width}`;
            expect(dist(camera, planet), label).toBeGreaterThanOrEqual(reach * 2.5);
            expect(dist(camera, planet), label).toBeGreaterThan(0.4);
            // Never a view along the orbit (S1 mobile: tip-on dart, stacked trail).
            const sight = normalize([
              camera[0] - planet[0],
              camera[1] - planet[1],
              camera[2] - planet[2],
            ]);
            const tangent = orbitTangent(node, orbit, angle);
            const cos = Math.abs(
              sight[0] * tangent[0] + sight[1] * tangent[1] + sight[2] * tangent[2],
            );
            expect(cos, `${label} tangent`).toBeLessThanOrEqual(PLANET_VIEW.maxTangentCos + 1e-9);
            expect(dist(camera, node.position), label).toBeGreaterThan(CORE_CORONA_RADIUS);
            if (node.core === 'comet') {
              // Outside the comet core's particle tail.
              const end: Vec3 = [
                node.position[0] + COMET_TAIL_CAPSULE.end[0],
                node.position[1] + COMET_TAIL_CAPSULE.end[1],
                node.position[2] + COMET_TAIL_CAPSULE.end[2],
              ];
              let nearest = Infinity;
              for (let k = 0; k <= 50; k++) {
                const t = k / 50;
                nearest = Math.min(
                  nearest,
                  dist(camera, [
                    node.position[0] + (end[0] - node.position[0]) * t,
                    node.position[1] + (end[1] - node.position[1]) * t,
                    node.position[2] + (end[2] - node.position[2]) * t,
                  ]),
                );
              }
              expect(nearest, `${label} comet tail`).toBeGreaterThanOrEqual(
                COMET_TAIL_CAPSULE.radius - 0.01,
              );
            }
            for (const other of node.orbits) {
              const clearance = orbitDistance(
                camera,
                node,
                other,
                other === orbit ? angle : undefined,
              );
              expect(clearance, `${label} vs ${other.serviceSlug}`).toBeGreaterThanOrEqual(
                planetReach(other),
              );
            }
          }
        }
      }
    }
  });

  it('shows the planet body at 25–60 % of the free rect short side', () => {
    for (const [view, rect] of views) {
      const frame = resolveSafeFrame(rect, view.width, view.height);
      const short = Math.min(rect.width, rect.height);
      for (const node of model.categories) {
        for (const orbit of node.orbits) {
          const goal = computeCameraGoal(
            { mode: 'planet', category: node.categoryId, service: orbit.serviceSlug },
            model,
            view.width / view.height,
            frame,
          );
          const planet = planetWorldPosition(node.position, orbit, orbit.phase);
          const p = projectPx(goal, planet, view, frame, orbit.size);
          const fraction = (2 * p.r) / short;
          const label = `${node.categoryId}/${orbit.serviceSlug} ${view.width}`;
          expect(fraction, label).toBeGreaterThanOrEqual(0.25 - 0.01);
          expect(fraction, label).toBeLessThanOrEqual(0.6 + 0.01);
          // Its rings and moons stay inside the rect.
          expect(sphereInRect(goal, planet, planetReach(orbit), view, frame, rect), label).toBe(
            true,
          );
        }
      }
    }
  });
});

describe('portfolio framing room in the overview (S4)', () => {
  it('keeps the whole cluster (and its reticle) inside the free rect, clear of the HUD', () => {
    for (const [view, rect] of [
      [DESKTOP_VIEW, DESKTOP_HOME_RECT],
      [DESKTOP_VIEW, { x: 560, y: 72, width: 880, height: 560 }],
    ] as const) {
      const { goal, frame } = goalFor({ mode: 'universe' }, view, rect);
      expect(sphereInRect(goal, model.portfolio.position, 2.1, view, frame, rect)).toBe(true);
    }
  });
});

describe('planet focus follows the free frame (S3)', () => {
  it('re-targets the planet size when the sheet collapses, keeping the chosen side', () => {
    const node = model.categories[0]!;
    const orbit = node.orbits[0]!;
    const target = {
      mode: 'planet' as const,
      category: node.categoryId,
      service: orbit.serviceSlug,
    };
    const memo = {};
    const sheet = resolveSafeFrame(PHONE_SHEET_RECT, PHONE_VIEW.width, PHONE_VIEW.height);
    const collapsedRect = { x: 0, y: 64, width: 390, height: 560 };
    const collapsed = resolveSafeFrame(collapsedRect, PHONE_VIEW.width, PHONE_VIEW.height);
    const aspect = PHONE_VIEW.width / PHONE_VIEW.height;
    const before = computeCameraGoal(target, model, aspect, sheet, { planetView: memo });
    const after = computeCameraGoal(target, model, aspect, collapsed, { planetView: memo });
    const fresh = computeCameraGoal(target, model, aspect, collapsed);
    const planet = planetWorldPosition(node.position, orbit, orbit.phase);
    // The bigger free area brings the camera closer (same body share of a bigger rect)…
    expect(dist(after.position, planet)).not.toBeCloseTo(dist(before.position, planet), 3);
    // …to the same distance a fresh framing of that area would use.
    expect(dist(after.position, planet)).toBeCloseTo(dist(fresh.position, planet), 6);
    const p = projectPx(after, planet, PHONE_VIEW, collapsed, orbit.size);
    const fraction = (2 * p.r) / Math.min(collapsedRect.width, collapsedRect.height);
    expect(fraction).toBeGreaterThan(0.25);
  });
});

describe('phone system views show every planet body (MJ-F3-03)', () => {
  it('keeps each boosted body at the 18 px minimum above the sheet', () => {
    const frame = resolveSafeFrame(PHONE_SHEET_RECT, PHONE_VIEW.width, PHONE_VIEW.height);
    for (const node of model.categories) {
      const { goal } = goalFor(
        { mode: 'system', category: node.categoryId },
        PHONE_VIEW,
        PHONE_SHEET_RECT,
      );
      const tan = Math.tan((goal.fov * Math.PI) / 360);
      for (const orbit of node.orbits) {
        for (const angle of [0, 1.6, 3.2, 4.8]) {
          const planet = planetWorldPosition(node.position, orbit, angle);
          const p = projectPx(goal, planet, PHONE_VIEW, frame);
          const ppu = PHONE_VIEW.height / (2 * tan * p.z);
          const body = orbit.size * PLANET_SHAPES[orbit.planet.shape].body;
          const px = 2 * body * ppu * planetScreenBoost(body, ppu);
          // The full minimum unless the boost is capped (MJ-F3-03: sparse and flat bodies).
          const capped = planetScreenBoost(body, ppu) >= MAX_PLANET_BOOST;
          expect(px, `${node.categoryId}/${orbit.serviceSlug}`).toBeGreaterThanOrEqual(
            capped ? 12 : MIN_PLANET_DIAMETER_PX - 1e-6,
          );
        }
      }
    }
  });
});
