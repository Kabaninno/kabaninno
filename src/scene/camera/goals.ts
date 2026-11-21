import type { SceneTarget } from '@/lib/route-state';
import type { SafeRect } from '@/store/scene';
import { CAMERA } from '../config';
import { degToRad, orbitPosition, type MutableVec3 } from '../orbit-math';
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
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
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

  let look: Vec3 = centroid;
  let distance: number = OVERVIEW.minDistance;

  // A few fixed-point iterations: fit the distance, then recentre on the projected extents.
  for (let iteration = 0; iteration < 5; iteration++) {
    distance = OVERVIEW.minDistance;
    for (const { p, r, tanV, tanH } of points) {
      const rel = sub(p, look);
      const x = Math.abs(dot(rel, right)) + r;
      const y = Math.abs(dot(rel, up)) + r;
      distance = Math.max(distance, Math.max(x / tanH, y / tanV) - dot(rel, forward));
    }
    distance = Math.min(distance, OVERVIEW.maxDistance);

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

  return { position: add(look, scale(dir, distance)), lookAt: look, fov };
}

/**
 * Camera goal for a URL target. `frame` is the free part of the viewport; the
 * focus is fitted into it (the rig shifts the principal point to its centre).
 * `sway`: idle auto-rotate amplitude the overview fit must cover.
 */
export function computeCameraGoal(
  target: SceneTarget,
  model: UniverseModel,
  aspect: number,
  frame: SafeFrame = FULL_FRAME,
  options: { sway?: number } = {},
): CameraGoal {
  const overview = overviewGoal(model, aspect, frame, options.sway ?? 0);
  const fov = overview.fov;

  switch (target.mode) {
    case 'system':
    case 'planet': {
      const node = findCategory(model, target.category);
      if (!node) return overview;
      if (target.mode === 'planet') {
        const orbit = node.orbits.find((o) => o.serviceSlug === target.service);
        if (orbit) return planetGoal(node, orbit, overview, aspect, frame);
      }
      const radius = Math.max(node.systemRadius * 1.2, 0.8);
      const distance = Math.max(fitDistance(radius, radius, fov, aspect, frame), 3.2);
      return approach(node.position, overview.position, distance, fov, 0.35);
    }
    case 'portfolio':
    case 'project': {
      const anchor = model.portfolio;
      const distance = Math.max(fitDistance(3.8, 3.4, fov, aspect, frame), 9);
      if (target.mode === 'project') {
        const index = Math.max(anchor.projectSlugs.indexOf(target.project), 0);
        const goal = approach(anchor.position, overview.position, distance * 0.62, fov, 0.2);
        return yawAround(goal, anchor.position, ((index % 5) - 2) * 0.22);
      }
      return approach(anchor.position, overview.position, distance, fov, 0.2);
    }
    case 'configurator': {
      const anchor = model.configurator;
      const distance = Math.max(fitDistance(4.6, 4.2, fov, aspect, frame), 8.5);
      return approach(anchor.position, overview.position, distance, fov, 0.18);
    }
    default:
      return overview;
  }
}

/**
 * Planet focus (placeholder until M3 tracks the live planet): closer to the
 * node, looking toward where the planet's orbit starts.
 */
function planetGoal(
  node: CategoryNodeModel,
  orbit: CategoryNodeModel['orbits'][number],
  overview: CameraGoal,
  aspect: number,
  frame: SafeFrame,
): CameraGoal {
  const radius = Math.max(node.systemRadius * 0.75, 0.6);
  const distance = Math.max(fitDistance(radius, radius, overview.fov, aspect, frame), 2.2);
  const start = orbitPosition(orbit, orbit.phase, { x: 0, y: 0, z: 0 } as MutableVec3);
  const lookAt: Vec3 = [
    node.position[0] + start.x * 0.45,
    node.position[1] + start.y * 0.45,
    node.position[2] + start.z * 0.45,
  ];
  return approach(lookAt, overview.position, distance, overview.fov, 0.3);
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

/** Rotates the goal position around the vertical axis through `center`. */
function yawAround(goal: CameraGoal, center: Vec3, angle: number): CameraGoal {
  const dx = goal.position[0] - center[0];
  const dz = goal.position[2] - center[2];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    ...goal,
    position: [center[0] + dx * c + dz * s, goal.position[1], center[2] - dx * s + dz * c],
  };
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
