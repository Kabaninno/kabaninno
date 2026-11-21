import type { SceneTarget } from '@/lib/route-state';
import type { SafeRect } from '@/store/scene';
import { CAMERA } from '../config';
import { degToRad } from '../orbit-math';
import {
  ARCHIVE,
  archiveBasis,
  archiveCenterOffset,
  archiveExtents,
} from '../portfolio/archive-layout';
import { NODE_CORE_RADIUS } from '../system/constants';
import { planetReach, planetWorldPosition } from '../system/planet-math';
import type { Vec3 } from '../types';
import type { CategoryNodeModel, UniverseModel, UniverseNode } from '../universe/model';

/**
 * Pure mapping from the URL-driven SceneTarget (plus the free part of the
 * viewport) to where the camera should be. The camera director
 * (CameraControls + GSAP flights) only animates toward this goal; it never
 * decides "where we are" itself.
 */
export interface CameraGoal {
  position: Vec3;
  lookAt: Vec3;
  /** Vertical field of view of the full viewport, degrees. */
  fov: number;
}

/**
 * The part of the viewport not covered by HTML overlays, as fractions (0..1)
 * of the viewport width/height, top-left origin (CSS convention).
 *
 * Framing contract (DECISIONS D28): the rig moves the camera's principal point
 * to the frame centre (`viewOffsetForFrame` → `camera.setViewOffset`), so the
 * goal's `lookAt` projects to the middle of the free area, and every goal here
 * is fitted against the frame's extents instead of the whole viewport.
 */
export interface SafeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_FRAME: Readonly<SafeFrame> = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });

/**
 * Smallest frame side as a share of the viewport side. When overlays cover
 * almost everything (an expanded sheet), the frame grows around its centre
 * instead of shrinking the subject to a few pixels.
 */
export const MIN_FRAME_FRACTION = 0.25;

/**
 * Converts the UI's safe rectangle (CSS px, viewport top-left origin) into a
 * clamped `SafeFrame`. `null`, non-finite or empty input means "whole viewport".
 */
export function resolveSafeFrame(
  rect: SafeRect | null | undefined,
  viewportWidth: number,
  viewportHeight: number,
): SafeFrame {
  if (!rect || !(viewportWidth > 0) || !(viewportHeight > 0)) return FULL_FRAME;
  const { x, y, width, height } = rect;
  if (![x, y, width, height].every(Number.isFinite) || !(width > 0) || !(height > 0)) {
    return FULL_FRAME;
  }
  const [left, frameWidth] = span(x / viewportWidth, (x + width) / viewportWidth);
  const [top, frameHeight] = span(y / viewportHeight, (y + height) / viewportHeight);
  return { x: left, y: top, width: frameWidth, height: frameHeight };
}

/** Clamps [a, b] to [0, 1] and widens it around its centre to the minimum span. */
function span(a: number, b: number): [start: number, length: number] {
  const start = clamp(a, 0, 1);
  const end = clamp(b, 0, 1);
  if (end - start >= MIN_FRAME_FRACTION) return [start, end - start];
  const centre = clamp((start + end) / 2, 0, 1);
  return [clamp(centre - MIN_FRAME_FRACTION / 2, 0, 1 - MIN_FRAME_FRACTION), MIN_FRAME_FRACTION];
}

/** Frame centre in viewport fractions. */
export function frameCenter(frame: SafeFrame): { x: number; y: number } {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

/**
 * `camera.setViewOffset(w, h, offsetX, offsetY, w, h)` offsets (CSS px) that
 * move the principal point from the viewport centre to (centerX, centerY),
 * given in viewport fractions.
 */
export function viewOffsetForCenter(
  centerX: number,
  centerY: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  return { x: (0.5 - centerX) * viewportWidth, y: (0.5 - centerY) * viewportHeight };
}

/**
 * Overview framing. The ring is an ellipse, so a frontal view stacks the side
 * nodes on top of each other; these directions keep every node clearly
 * separated (searched numerically for the 5 categories). Distance and look
 * target are then fitted to the actual nodes, so the framing is data-driven.
 */
export const OVERVIEW = {
  /** Elevated three-quarter view for landscape frames. */
  landscape: { elevation: degToRad(26), azimuth: degToRad(-22) },
  /**
   * Narrow portrait frames look down the ring's long axis from above, so the
   * constellation fills the height (~1.8x larger nodes). The distant portfolio
   * cluster is not forced into this frame (it would shrink every node ~2x).
   */
  portrait: { elevation: degToRad(65), azimuth: degToRad(-100) },
  /**
   * Viewport aspect below which the portrait view is used when the whole
   * viewport is free (no safe rect, D26).
   */
  portraitBelowAspect: 0.8,
  /**
   * With a safe rect, the portrait view (which leaves the portfolio out) only
   * for really narrow free areas. Above this, the landscape layout is fitted
   * into the rect, so every node — portfolio included — lands inside it
   * (visual V2-01: a 626×796 column at 1536×864 put the portfolio behind the
   * hero copy).
   */
  portraitInRectBelowAspect: 0.65,
  minDistance: 18,
  maxDistance: 90,
} as const;

/** Vertical FOV for a viewport aspect: 50° on landscape, widening on portrait. */
export function fovForAspect(aspect: number): number {
  if (!(aspect > 0) || aspect >= 1) return CAMERA.fov;
  const t = clamp((1 - aspect) / 0.55, 0, 1);
  return CAMERA.fov + (CAMERA.portraitFov - CAMERA.fov) * t;
}

/** Half-angle tangents of the part of the frustum that the frame covers. */
export function frameTangents(
  fovDeg: number,
  aspect: number,
  frame: SafeFrame = FULL_FRAME,
): { tanV: number; tanH: number } {
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const safeAspect = aspect > 0 ? aspect : 1;
  return { tanV: tan * frame.height, tanH: tan * safeAspect * frame.width };
}

/** Aspect (width / height, in px) of the frame inside a viewport of `aspect`. */
export function frameAspect(aspect: number, frame: SafeFrame = FULL_FRAME): number {
  const safeAspect = aspect > 0 ? aspect : 1;
  return (safeAspect * frame.width) / frame.height;
}

/**
 * Distance at which a box of the given half extents, centred on the principal
 * point, fits inside the frame.
 */
export function fitDistance(
  halfWidth: number,
  halfHeight: number,
  fovDeg: number,
  aspect: number,
  frame: SafeFrame = FULL_FRAME,
) {
  const { tanV, tanH } = frameTangents(fovDeg, aspect, frame);
  return Math.max(halfHeight / tanV, halfWidth / tanH);
}

/**
 * World radius a node needs on screen and the share of the half-frame it may
 * use: categories keep breathing room, anchors may sit closer to the edge.
 */
function nodeFraming(node: UniverseNode): { radius: number; margin: number } {
  switch (node.kind) {
    case 'category':
      return { radius: Math.max(node.systemRadius, 1) + 0.4, margin: 0.86 };
    case 'portfolio':
      return { radius: 1.2, margin: 0.97 };
    case 'configurator':
      return { radius: 1.8, margin: 0.9 };
  }
}

export function isPortrait(aspect: number): boolean {
  return aspect > 0 && aspect < OVERVIEW.portraitBelowAspect;
}

/** Whether the overview uses the portrait layout for this frame (see OVERVIEW). */
export function usesPortraitOverview(aspect: number, frame: SafeFrame = FULL_FRAME): boolean {
  const shape = frameAspect(aspect, frame);
  if (isFullFrame(frame)) return isPortrait(shape);
  return shape > 0 && shape < OVERVIEW.portraitInRectBelowAspect;
}

function isFullFrame(frame: SafeFrame): boolean {
  return frame.x === 0 && frame.y === 0 && frame.width === 1 && frame.height === 1;
}

/**
 * Fits the universe nodes into the frame from the overview direction.
 * Portrait frames leave the distant portfolio cluster out (D26). `sway`
 * (radians) widens the fit to cover the idle auto-rotate range, so the
 * swaying network never drifts out of the free area (visual V2-08).
 */
export function overviewGoal(
  model: UniverseModel,
  aspect: number,
  frame: SafeFrame = FULL_FRAME,
  sway = 0,
): CameraGoal {
  const fov = fovForAspect(aspect);
  const { tanV: frameTanV, tanH: frameTanH } = frameTangents(fov, aspect, frame);
  const portrait = usesPortraitOverview(aspect, frame);
  const { elevation, azimuth } = portrait ? OVERVIEW.portrait : OVERVIEW.landscape;
  const dir: Vec3 = [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ];
  const framed = model.nodes.filter((node) => !(portrait && node.kind === 'portfolio'));
  const centroid: Vec3 = framed.length
    ? scale(
        framed.reduce<Vec3>((sum, node) => add(sum, node.position), [0, 0, 0]),
        1 / framed.length,
      )
    : [0, 0, 0];
  // Swaying the camera by ±sway around the vertical axis equals swaying the
  // nodes by ∓sway around it: fit those positions too.
  const angles = sway > 0 ? [0, -sway, sway, -sway / 2, sway / 2] : [0];
  const points = framed.flatMap((node) => {
    const { radius, margin } = nodeFraming(node);
    return angles.map((angle) => ({
      p: rotateY(node.position, centroid, angle),
      r: radius,
      tanV: frameTanV * margin,
      tanH: frameTanH * margin,
    }));
  });

  const fitted = fitPoints(points, dir, centroid, OVERVIEW.minDistance, OVERVIEW.maxDistance);
  const distance = fitted.distance;
  const mass = model.nodes.filter((node) => node.kind !== 'portfolio').map((node) => node.position);
  const look = balanceOnMass(fitted.look, distance, dir, points, mass);
  return { position: add(look, scale(dir, distance)), lookAt: look, fov };
}

/** Share of the way the network's centroid moves toward the frame centre (visual L-04). */
const OVERVIEW_BALANCE = 0.6;

/**
 * The fit centres the bounding box of every node, so the distant portfolio
 * cluster (up and back) pulled the network off-centre (visual L-04: pushed
 * right, empty top-left). The slack left on the looser axis is used to move
 * the network's centroid toward the frame centre, never letting any fitted
 * sphere leave its frame tangents.
 */
function balanceOnMass(
  look: Vec3,
  distance: number,
  dir: Vec3,
  points: readonly FitPoint[],
  mass: readonly Vec3[],
): Vec3 {
  if (mass.length === 0) return look;
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const project = (p: Vec3) => {
    const rel = sub(p, look);
    const depth = Math.max(distance + dot(rel, forward), 0.1);
    return { x: dot(rel, right) / depth, y: dot(rel, up) / depth, depth };
  };
  let cx = 0;
  let cy = 0;
  for (const p of mass) {
    const q = project(p);
    cx += q.x / mass.length;
    cy += q.y / mass.length;
  }
  // Allowed shift (tangent units) keeping every sphere inside its tangents.
  let loX = -Infinity;
  let hiX = Infinity;
  let loY = -Infinity;
  let hiY = Infinity;
  for (const point of points) {
    const q = project(point.p);
    const r = point.r / q.depth;
    // Moving the look target by s (tangent units at `distance`) moves this point by s·k.
    const k = distance / q.depth;
    loX = Math.max(loX, (q.x + r - point.tanH) / k);
    hiX = Math.min(hiX, (q.x - r + point.tanH) / k);
    loY = Math.max(loY, (q.y + r - point.tanV) / k);
    hiY = Math.min(hiY, (q.y - r + point.tanV) / k);
  }
  const shiftX = clamp(cx * OVERVIEW_BALANCE, Math.min(loX, 0), Math.max(hiX, 0));
  const shiftY = clamp(cy * OVERVIEW_BALANCE, Math.min(loY, 0), Math.max(hiY, 0));
  return add(look, add(scale(right, shiftX * distance), scale(up, shiftY * distance)));
}

/** A sphere to keep in the frame: centre, radius and the frame tangents it may use. */
interface FitPoint {
  p: Vec3;
  r: number;
  tanV: number;
  tanH: number;
}

/**
 * Distance and look target from which every sphere fits its frame tangents,
 * looking along `-dir` (up = +Y): fixed-point iterations that fit the
 * distance, then recentre on the projected extents so the group centres in
 * the frame. `finalFit` refits the distance at the final look target, which
 * guarantees containment when the recentring has not fully converged (wide,
 * deep groups such as the configurator selection).
 */
function fitPoints(
  points: readonly FitPoint[],
  dir: Vec3,
  start: Vec3,
  minDistance: number,
  maxDistance: number,
  { iterations = 5, finalFit = false }: { iterations?: number; finalFit?: boolean } = {},
): { look: Vec3; distance: number } {
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const fitDistanceAt = (look: Vec3) => {
    let distance = minDistance;
    for (const { p, r, tanV, tanH } of points) {
      const rel = sub(p, look);
      const x = Math.abs(dot(rel, right)) + r;
      const y = Math.abs(dot(rel, up)) + r;
      distance = Math.max(distance, Math.max(x / tanH, y / tanV) - dot(rel, forward));
    }
    return Math.min(distance, maxDistance);
  };
  let look = start;
  let distance = minDistance;
  for (let iteration = 0; iteration < iterations; iteration++) {
    distance = fitDistanceAt(look);

    // Extents in units of each axis' frame tangent, so the box centres in the frame.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const { p, r } of points) {
      const rel = sub(p, look);
      const depth = Math.max(distance + dot(rel, forward), 0.1);
      const x = dot(rel, right) / depth;
      const y = dot(rel, up) / depth;
      minX = Math.min(minX, x - r / depth);
      maxX = Math.max(maxX, x + r / depth);
      minY = Math.min(minY, y - r / depth);
      maxY = Math.max(maxY, y + r / depth);
    }
    if (!Number.isFinite(minX)) break;
    look = add(
      look,
      add(scale(right, ((minX + maxX) / 2) * distance), scale(up, ((minY + maxY) / 2) * distance)),
    );
  }
  if (finalFit) distance = fitDistanceAt(look);
  return { look, distance };
}

/**
 * Configurator with a selection (D81): the beacon plus the selected nodes,
 * fitted into the free frame from the beacon focus' viewing direction, never
 * closer than the beacon focus itself. Nodes join nearest-first while the fit
 * stays within `maxDistance` (the overview distance); if not all of them fit,
 * the framing keeps the beacon and the nearest selected nodes with the
 * network around them instead of zooming out past the overview. `sway`: the
 * idle auto-rotate range the fit must cover (as in the overview).
 */
export function selectionGoal(
  model: UniverseModel,
  focus: CameraGoal,
  selected: readonly UniverseNode[],
  aspect: number,
  frame: SafeFrame,
  maxDistance: number,
  sway = 0,
): CameraGoal {
  if (selected.length === 0) return focus;
  const anchor = model.configurator;
  const { tanV, tanH } = frameTangents(focus.fov, aspect, frame);
  const angles = sway > 0 ? [0, -sway, sway, -sway / 2, sway / 2] : [0];
  const toPoints = (node: UniverseNode, centroid: Vec3): FitPoint[] => {
    const { radius, margin } = selectionFraming(node);
    return angles.map((angle) => ({
      p: rotateY(node.position, centroid, angle),
      r: radius,
      tanV: tanV * margin,
      tanH: tanH * margin,
    }));
  };
  const dir = normalize(sub(focus.position, focus.lookAt));
  const minDistance = Math.hypot(...sub(focus.position, focus.lookAt));
  const ordered = [...selected].sort(
    (a, b) =>
      Math.hypot(...sub(a.position, anchor.position)) -
      Math.hypot(...sub(b.position, anchor.position)),
  );
  let best = focus;
  for (let n = 1; n <= ordered.length; n++) {
    const group = [anchor, ...ordered.slice(0, n)];
    const centroid = scale(
      group.reduce<Vec3>((sum, node) => add(sum, node.position), [0, 0, 0]),
      1 / group.length,
    );
    const points = group.flatMap((node) => toPoints(node, centroid));
    const fit = fitPoints(points, dir, centroid, minDistance, Infinity, {
      iterations: 12,
      finalFit: true,
    });
    if (fit.distance > maxDistance) break;
    best = { position: add(fit.look, scale(dir, fit.distance)), lookAt: fit.look, fov: focus.fov };
  }
  return best;
}

/** Configurator: content sits this share of the frame height above centre (visual MN-4). */
export const CONFIGURATOR_LIFT = 0.08;

/**
 * Raises the framed content by `lift` × the frame height (camera and look
 * target move down together), as far as the topmost node — with its framing
 * radius — stays inside the frame.
 */
export function liftInFrame(
  goal: CameraGoal,
  nodes: readonly UniverseNode[],
  aspect: number,
  frame: SafeFrame,
  lift: number,
): CameraGoal {
  const { tanV } = frameTangents(goal.fov, aspect, frame);
  const back = sub(goal.position, goal.lookAt);
  const distance = Math.hypot(...back);
  const forward = scale(back, -1 / distance);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  let top = -Infinity;
  for (const node of nodes) {
    const rel = sub(node.position, goal.position);
    const z = dot(rel, forward);
    if (z <= 0.1) continue;
    top = Math.max(top, (dot(rel, up) + selectionFraming(node).radius) / z);
  }
  const room = Number.isFinite(top) ? tanV * 0.97 - top : 2 * lift * tanV;
  const shift = Math.max(0, Math.min(2 * lift * tanV, room)) * distance;
  if (shift <= 0) return goal;
  const down = scale(up, -shift);
  return { ...goal, position: add(goal.position, down), lookAt: add(goal.lookAt, down) };
}

/**
 * Selection framing per node: the beacon with its pings, a selected category
 * with its glowing core and halo (not the whole orbit preview, which would
 * push the camera far back for little gain).
 */
function selectionFraming(node: UniverseNode): { radius: number; margin: number } {
  switch (node.kind) {
    case 'configurator':
      return { radius: 1.8, margin: 0.9 };
    case 'category':
      return { radius: Math.max(Math.min(node.systemRadius, 2.2), 1.2), margin: 0.86 };
    case 'portfolio':
      return { radius: 1.6, margin: 0.9 };
  }
}

/**
 * Camera goal for a URL target. `frame` is the free part of the viewport; the
 * focus is fitted into it (the rig shifts the principal point to its centre).
 * `sway`: idle auto-rotate amplitude the overview fit must cover.
 * `planetAngle`: live orbit angle of the focused planet (planet mode).
 * `emphasis`: configurator selection (store `emphasis`, D81), configurator mode only.
 */
export function computeCameraGoal(
  target: SceneTarget,
  model: UniverseModel,
  aspect: number,
  frame: SafeFrame = FULL_FRAME,
  options: {
    sway?: number;
    planetAngle?: number;
    emphasis?: readonly string[];
    /** Planet focus: keeps the chosen viewing side stable while the planet parks. */
    planetView?: PlanetViewMemo;
  } = {},
): CameraGoal {
  const overview = overviewGoal(model, aspect, frame, options.sway ?? 0);
  const fov = overview.fov;

  switch (target.mode) {
    case 'system':
    case 'planet': {
      const node = findCategory(model, target.category);
      if (!node) return overview;
      const system = systemGoal(node, overview.position, fov, aspect, frame);
      if (target.mode === 'planet') {
        const orbit = node.orbits.find((o) => o.serviceSlug === target.service);
        // The live angle comes from the system view; deep links start at the orbit phase.
        if (orbit) {
          return planetGoal(
            node,
            orbit,
            options.planetAngle ?? orbit.phase,
            system,
            aspect,
            frame,
            options.planetView,
          );
        }
      }
      return system;
    }
    case 'portfolio':
    case 'project':
      return archiveGoal(
        model,
        target.mode === 'project' ? target.project : null,
        aspect,
        frame,
        fov,
      );
    case 'configurator': {
      const anchor = model.configurator;
      const distance = Math.max(fitDistance(4.6, 4.2, fov, aspect, frame), 8.5);
      const focus = approach(anchor.position, overview.position, distance, fov, 0.18);
      const selected = (options.emphasis ?? [])
        .map((key) => model.byKey.get(key))
        .filter((node): node is UniverseNode => !!node && node.kind !== 'configurator');
      const goal = selectionGoal(
        model,
        focus,
        selected,
        aspect,
        frame,
        // Never wider than the overview (which already shows every node).
        Math.hypot(...sub(overview.position, overview.lookAt)),
        options.sway ?? 0,
      );
      return liftInFrame(goal, [anchor, ...selected], aspect, frame, CONFIGURATOR_LIFT);
    }
    default:
      return overview;
  }
}

/**
 * System view fit (visual MJ2): the camera looks at the core from the side the
 * system is approached from (lifted), at the distance where the actual
 * orbits — sampled with each planet's reach, over the whole idle spin around
 * the vertical axis — span at most SYSTEM_FIT.width of the free width and
 * SYSTEM_FIT.height of its height. A bounding sphere left phone systems tiny.
 */
/**
 * Idle motion range a system view must cover: the full spin, or — in short
 * free areas (a phone band above the sheet), where the spin's envelope would
 * keep the system small — a gentle sway of ±SYSTEM_SWAY (CameraDirector).
 */
export const SYSTEM_SWAY = 0.35;

export function usesSystemSway(frame: SafeFrame): boolean {
  return frame.height < 0.5;
}

export function systemSpinRange(frame: SafeFrame): number {
  return usesSystemSway(frame) ? SYSTEM_SWAY : Math.PI;
}

export const SYSTEM_FIT = {
  width: 0.9,
  height: 0.9,
  lift: 0.35,
  shortLift: 0.1,
  /** Samples per orbit and camera spin angles covered. */
  samples: 24,
  spins: 8,
  /** Planets may grow on small screens (planetScreenBoost): keep room for it. */
  reachMargin: 1.2,
  minDistance: 3.2,
} as const;

export function systemGoal(
  node: CategoryNodeModel,
  from: Vec3,
  fov: number,
  aspect: number,
  frame: SafeFrame,
  spinRange: number = systemSpinRange(frame),
): CameraGoal {
  const toward = normalize(sub(from, node.position));
  // Short free areas: a flatter view, so the orbit ellipses take less height.
  const lift = usesSystemSway(frame) ? SYSTEM_FIT.shortLift : SYSTEM_FIT.lift;
  const dir = normalize([toward[0], toward[1] + lift, toward[2]]);
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const { tanV, tanH } = frameTangents(fov, aspect, frame);
  const limitH = tanH * SYSTEM_FIT.width;
  const limitV = tanV * SYSTEM_FIT.height;
  let distance: number = SYSTEM_FIT.minDistance;
  const fit = (offset: Vec3, r: number) => {
    const x = Math.abs(dot(offset, right)) + r;
    const y = Math.abs(dot(offset, up)) + r;
    distance = Math.max(distance, Math.max(x / limitH, y / limitV) - dot(offset, forward));
  };
  fit([0, 0, 0], CORE_KEEP_OUT);
  for (const orbit of node.orbits) {
    const r = planetReach(orbit) * SYSTEM_FIT.reachMargin;
    for (let k = 0; k < SYSTEM_FIT.samples; k++) {
      const p = sub(
        planetWorldPosition(node.position, orbit, (k / SYSTEM_FIT.samples) * Math.PI * 2),
        node.position,
      );
      for (let spin = 0; spin < SYSTEM_FIT.spins; spin++) {
        const t = SYSTEM_FIT.spins > 1 ? spin / (SYSTEM_FIT.spins - 1) : 0.5;
        const angle =
          spinRange >= Math.PI ? (spin / SYSTEM_FIT.spins) * Math.PI * 2 : (t * 2 - 1) * spinRange;
        fit(rotateY(p, [0, 0, 0], angle), r);
      }
    }
  }
  return { position: add(node.position, scale(dir, distance)), lookAt: [...node.position], fov };
}

/**
 * Planet focus: the camera looks at the planet's live position (the planet
 * parks on its orbit while focused) from outside its orbit, roughly from the
 * side the system was approached from, so the core lights the planet from
 * the side. The planet with its rings and moons is fitted into the free
 * frame (the panel or sheet covers the rest). The viewing side turns around
 * the planet (nearest yaw first) until the core with its corona is out of
 * the frame, or at least 1.5 planet radii clear of the planet's reach
 * (visual MJ1: a big, close core overlapped the rings and flooded the frame).
 */
export function planetGoal(
  node: CategoryNodeModel,
  orbit: CategoryNodeModel['orbits'][number],
  angle: number,
  system: CameraGoal,
  aspect: number,
  frame: SafeFrame,
  memo?: PlanetViewMemo,
): CameraGoal {
  const planet = planetWorldPosition(node.position, orbit, angle);
  const reach = planetReach(orbit);
  const fov = system.fov;
  const distance = Math.max(
    fitDistance(reach * PLANET_FRAMING, reach * PLANET_FRAMING, fov, aspect, frame),
    reach * 3.2,
  );
  const toSystemCamera = normalize(sub(system.position, node.position));
  const outward = normalize(sub(planet, node.position));
  const base = normalize(add(add(toSystemCamera, scale(outward, 0.6)), [0, 0.22, 0]));
  const { tanV, tanH } = frameTangents(fov, aspect, frame);
  const azimuth = Math.atan2(base[0], base[2]);
  const elevation = Math.asin(clamp(base[1], -1, 1));
  const viewDir = ([yaw, pitch]: readonly [number, number]): Vec3 => {
    const e = clamp(elevation + pitch, -0.9, 1.25);
    const a = azimuth + yaw;
    return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  };
  const clearance = (offset: readonly [number, number]) =>
    planetCoreClearance(
      node.position,
      planet,
      viewDir(offset),
      distance,
      reach,
      orbit.size,
      tanV,
      tanH,
    );
  let best: readonly [number, number] = [0, 0];
  let bestScore = -Infinity;
  for (const offset of PLANET_VIEW_OFFSETS) {
    const score = clearance(offset);
    if (score > bestScore) {
      bestScore = score;
      best = offset;
    }
    if (score >= 1) break;
  }
  // Hysteresis: keep the previous side while it is still (nearly) as good.
  const key = `${node.categoryId}/${orbit.serviceSlug}`;
  if (memo?.key === key && memo.offset) {
    const kept = clearance(memo.offset);
    if (kept >= Math.min(bestScore, 1) - 0.1) best = memo.offset;
  }
  if (memo) {
    memo.key = key;
    memo.offset = best;
  }
  return { position: add(planet, scale(viewDir(best), distance)), lookAt: planet, fov };
}

/** Planet focus: the viewing side chosen last time (see planetGoal). */
export interface PlanetViewMemo {
  key?: string;
  offset?: readonly [number, number];
}

/**
 * Viewing sides tried around a focused planet as [yaw, pitch] offsets from
 * the approach side (radians), the smallest change first.
 */
const PLANET_VIEW_OFFSETS: ReadonlyArray<readonly [number, number]> = (() => {
  const offsets: Array<[number, number]> = [];
  for (let step = -10; step <= 10; step++) {
    for (const pitch of [0, 0.3, -0.25, 0.6, 0.9]) offsets.push([step * 0.25, pitch]);
  }
  return offsets.sort(
    (a, b) => Math.abs(a[0]) + Math.abs(a[1]) * 1.2 - (Math.abs(b[0]) + Math.abs(b[1]) * 1.2),
  );
})();
/**
 * Radius the system core occupies in planet focus, world units: the core
 * body (slightly enlarged in the system view) plus the inner glow — the
 * corona shrinks and dims while a planet is focused (SystemContent).
 */
export const CORE_KEEP_OUT = NODE_CORE_RADIUS * 1.1 * 1.6;

/**
 * How clear the system core is of a planet viewed from `dir` (camera at
 * `planet + dir · distance`, looking at the planet, up = +Y): 1 when the core
 * is outside the frame or at least 1.5 planet radii (`size`) clear of the
 * planet's reach on screen; less when it crowds the planet (0 = touching,
 * negative = overlapping);
 * 0.9 when the core is behind the camera (clear, but the planet is lit from
 * the front, so a side view is preferred).
 */
export function planetCoreClearance(
  core: Vec3,
  planet: Vec3,
  dir: Vec3,
  distance: number,
  reach: number,
  size: number,
  tanV: number,
  tanH: number,
): number {
  const camera = add(planet, scale(dir, distance));
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const rel = sub(core, camera);
  const z = dot(rel, forward);
  if (z <= 0) return Math.hypot(...rel) > CORE_KEEP_OUT ? 0.9 : 0;
  const x = dot(rel, right) / z;
  const y = dot(rel, up) / z;
  const coreSize = CORE_KEEP_OUT / z;
  if (Math.abs(x) - coreSize > tanH || Math.abs(y) - coreSize > tanV) return 1;
  const gap = Math.hypot(x, y) - coreSize - reach / distance;
  // Negative while the core overlaps the planet's reach: the least overlap still wins.
  return Math.min(gap / ((1.5 * size) / distance), 1);
}

/** Planet focus: half extent of the fitted box relative to the planet's reach. */
export const PLANET_FRAMING = 1.35;

/** Project focus: half extent of the fitted box relative to the card's half size. */
export const PROJECT_FRAMING = 1.5;
/** Archive view: margin around the wall of cards (covers the idle sway). */
const ARCHIVE_MARGIN = 1.1;

/**
 * Portfolio archive views, all looking at the wall head-on (along
 * `-ARCHIVE_FACING`, so the cards — which turn to the viewer — read flat):
 * - portfolio: the whole wall of card-objects fitted into the free frame;
 *   with no projects, the dormant cluster itself;
 * - project: that card fitted into the frame (its siblings dim around it),
 *   seen slightly from the outer side so the wall keeps its depth.
 * An unknown project slug falls back to the portfolio view.
 */
export function archiveGoal(
  model: UniverseModel,
  project: string | null,
  aspect: number,
  frame: SafeFrame,
  fov: number,
): CameraGoal {
  const anchor = model.portfolio;
  const { right, facing } = archiveBasis();
  if (anchor.projects.length === 0) {
    const distance = Math.max(fitDistance(3.8, 3.4, fov, aspect, frame), 9);
    return {
      position: add(anchor.position, scale(facing, distance)),
      lookAt: [...anchor.position],
      fov,
    };
  }
  const card = project ? anchor.projects.find((entry) => entry.slug === project) : undefined;
  if (card) {
    const center = add(anchor.position, card.offset);
    const distance = Math.max(
      fitDistance(
        (ARCHIVE.cardWidth / 2) * PROJECT_FRAMING,
        (ARCHIVE.cardHeight / 2) * PROJECT_FRAMING,
        fov,
        aspect,
        frame,
      ),
      2.4,
    );
    const side = Math.sign(dot(card.offset, right));
    const dir = normalize(add(facing, scale(right, side * 0.16)));
    return { position: add(center, scale(dir, distance)), lookAt: center, fov };
  }
  const center = add(anchor.position, archiveCenterOffset());
  const { halfWidth, halfHeight } = archiveExtents(anchor.projects.length);
  const distance = Math.max(
    fitDistance(
      halfWidth * ARCHIVE_MARGIN + 0.25,
      halfHeight * ARCHIVE_MARGIN + 0.25,
      fov,
      aspect,
      frame,
    ),
    5,
  );
  return { position: add(center, scale(facing, distance)), lookAt: center, fov };
}

/**
 * User input limits around a goal (CameraControls): the dolly range is
 * relative to the fitted distance and the polar range to the goal elevation,
 * so whatever the visitor does, the focus stays in view at a sane size (the
 * orbit pivot is always the goal's look target; panning is disabled).
 */
export interface ControlLimits {
  minDistance: number;
  maxDistance: number;
  minPolar: number;
  maxPolar: number;
}

export function controlLimits(
  target: SceneTarget,
  goalRadius: number,
  goalPolar: number,
): ControlLimits {
  const radius = Math.max(goalRadius, 0.1);
  const polarRange = (below: number, above: number, floor: number, ceiling: number) => ({
    minPolar: clamp(goalPolar - above, floor, goalPolar),
    maxPolar: clamp(goalPolar + below, goalPolar, ceiling),
  });
  switch (target.mode) {
    case 'system':
    case 'planet':
      return {
        minDistance: radius * 0.5,
        maxDistance: radius * 1.9,
        ...polarRange(0.75, 0.9, 0.22, Math.PI - 0.5),
      };
    case 'portfolio':
    case 'project':
    case 'configurator':
      return {
        minDistance: radius * 0.55,
        maxDistance: radius * 1.6,
        ...polarRange(0.55, 0.7, 0.3, Math.PI * 0.62),
      };
    default:
      // Overview: never dive under the ring plane or look straight down on it.
      return {
        minDistance: radius * 0.6,
        maxDistance: radius * 1.4,
        ...polarRange(0.42, 0.55, 0.35, Math.PI / 2 + 0.18),
      };
  }
}

/**
 * Minimum on-screen diameter of a universe core (CSS px) for a free frame of
 * `frameWidthPx` × `frameHeightPx`: ~5% of the frame's short side, so the
 * desktop home frame (824×564) gets 28 px and landscape phones still get a
 * readable 12–14 px signal point instead of a grey pearl (N-07, M3-04).
 * Desktop (fine pointer) never goes below 18 px (visual V2-02: 16 px cores
 * in the short frames of 1366×768 laptops).
 */
export function minCoreDiameterPx(
  frameWidthPx: number,
  frameHeightPx: number,
  desktop = false,
): number {
  const short = Math.min(frameWidthPx, frameHeightPx);
  const floor = desktop ? 18 : 12;
  if (!(short > 0)) return Math.max(20, floor);
  return clamp(short * 0.05, floor, 30);
}

/** Camera placed `distance` away from `center`, on the side of `from`, lifted by `lift`. */
function approach(center: Vec3, from: Vec3, distance: number, fov: number, lift: number) {
  const toward = normalize(sub(from, center));
  const dir = normalize([toward[0], toward[1] + lift, toward[2]]);
  return { position: add(center, scale(dir, distance)), lookAt: [...center] as Vec3, fov };
}

/** Rotates `point` around the vertical axis through `center`. */
function rotateY(point: Vec3, center: Vec3, angle: number): Vec3 {
  if (angle === 0) return point;
  const dx = point[0] - center[0];
  const dz = point[2] - center[2];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [center[0] + dx * c + dz * s, point[1], center[2] - dx * s + dz * c];
}

function findCategory(model: UniverseModel, categoryId: string): CategoryNodeModel | undefined {
  return model.categories.find((category) => category.categoryId === categoryId);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(v: Vec3, factor: number): Vec3 {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}
