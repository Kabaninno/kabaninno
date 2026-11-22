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
import { COMET_TAIL_CAPSULE, CORE_CORONA_RADIUS, CORE_KEEP_OUT } from '../system/constants';
import { CORE_STYLES } from '../universe/core-styles';
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
 * Centre of the free area itself, in viewport fractions: the safe rect's
 * centre (clamped to the viewport). It differs from the frame's centre only
 * when the minimum frame size widened the frame against a viewport edge (a
 * phone band of a few dozen px above an expanded sheet). The viewport centre
 * when the rect is missing or invalid.
 */
export function freeAreaCenter(
  rect: SafeRect | null | undefined,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const frame = resolveSafeFrame(rect, viewportWidth, viewportHeight);
  if (!rect || frame === FULL_FRAME) return frameCenter(frame);
  const left = clamp(rect.x / viewportWidth, 0, 1);
  const right = clamp((rect.x + rect.width) / viewportWidth, 0, 1);
  const top = clamp(rect.y / viewportHeight, 0, 1);
  const bottom = clamp((rect.y + rect.height) / viewportHeight, 0, 1);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/**
 * Moves a goal across its view so that its look target projects to `point`
 * (viewport fractions) instead of the frame centre. Camera and look target
 * shift together by an amount proportional to the view distance, so a later
 * dolly along the view direction keeps the target at that point.
 */
export function centreOnPoint(
  goal: CameraGoal,
  point: { x: number; y: number },
  aspect: number,
  frame: SafeFrame = FULL_FRAME,
): CameraGoal {
  const centre = frameCenter(frame);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return goal;
  const back = sub(goal.position, goal.lookAt);
  const distance = Math.hypot(...back);
  if (!(distance > 0)) return goal;
  const forward = scale(back, -1 / distance);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  // View-space tangents at which the target must appear (the principal point stays put).
  const tan = Math.tan((goal.fov * Math.PI) / 360);
  const tanX = dx * 2 * tan * (aspect > 0 ? aspect : 1);
  const tanY = -dy * 2 * tan;
  const shift = scale(add(scale(right, tanX), scale(up, tanY)), -distance);
  return { ...goal, position: add(goal.position, shift), lookAt: add(goal.lookAt, shift) };
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
  /**
   * Phone home (B1): on a portrait viewport whose free frame is roughly square
   * (the band between the HUD and the hero block) the landscape view left the
   * network a thin strip in the middle of it. The "tall" view is the landscape
   * constellation seen from higher up and nearly head-on, so the ring's depth
   * (z) spreads over the screen's height as well: the network fills the free
   * frame's height (portfolio and beacon included) instead of a third of it.
   * Searched numerically over the free frames of 360×740 … 412×915 phones
   * (the elevation follows the frame's shape: a taller frame is looked at
   * from higher up).
   */
  tall: {
    azimuth: degToRad(-6),
    minElevation: degToRad(28),
    maxElevation: degToRad(66),
    /** Elevation (degrees) at a square-ish frame, and its change per unit of frame shape (w/h). */
    elevationDeg: 38,
    elevationSlopeDeg: 65,
    elevationShape: 1.2,
    /** Frame shapes (w/h) the view is used for: wider free frames keep the landscape view. */
    minShape: 0.65,
    maxShape: 1.45,
    /** Idle sway of the tall view relative to the landscape one (the fit must cover it). */
    swayShare: 0.5,
    /** Share of the half-frame a node may use (the free frame is nearly filled). */
    margin: { category: 1, portfolio: 1, configurator: 1 },
  },
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
function nodeFraming(
  node: UniverseNode,
  tall: { minCorePx: number; pxToTan: (px: number) => number } | null = null,
): { radius: number; margin: number; angular: number } {
  if (tall) {
    const { margin } = OVERVIEW.tall;
    // On a phone the nodes are drawn at their minimum on-screen size (bigger cores, orbit
    // previews widened to clear them): their extent is a size in px, not in world units.
    const { pxToTan, minCorePx } = tall;
    switch (node.kind) {
      case 'category':
        return {
          radius: 0.25,
          margin: margin.category,
          angular: pxToTan(orbitPreviewRadiusPx(node, minCorePx)),
        };
      case 'portfolio':
        return { radius: 0.5, margin: margin.portfolio, angular: pxToTan(minCorePx * 1.3) };
      case 'configurator':
        return { radius: 0.3, margin: margin.configurator, angular: pxToTan(minCorePx * 1.15) };
    }
  }
  switch (node.kind) {
    case 'category':
      return { radius: Math.max(node.systemRadius, 1) + 0.4, margin: 0.86, angular: 0 };
    case 'portfolio':
      // The cluster's visible star cloud (and its label reticle), not just its core
      // (S4: the reticle ran under the HUD).
      return { radius: 2.3, margin: 0.94, angular: 0 };
    case 'configurator':
      return { radius: 1.8, margin: 0.9, angular: 0 };
  }
}

/**
 * On-screen radius (px) of a category's orbit preview when its core is drawn
 * at `minCorePx`: the preview widens just enough to clear the enlarged core
 * (CategoryNode: orbit scale = 1.3 × core radius / innermost orbit), so the
 * outer orbit is 0.65 × minCorePx × outer / inner — whatever the distance —
 * plus a little for the orbit sparks.
 */
export function orbitPreviewRadiusPx(node: CategoryNodeModel, minCorePx: number): number {
  const radii = node.orbits.map((orbit) => orbit.radius).filter((radius) => radius > 0);
  if (radii.length === 0) return minCorePx;
  const ratio = Math.max(...radii) / Math.min(...radii);
  return Math.max(minCorePx * 0.9, 0.65 * minCorePx * ratio) + 4;
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
 * Whether the home overview uses the "tall" phone view (see OVERVIEW.tall): a
 * portrait viewport with a free frame that is neither a narrow column (the
 * portrait layout) nor a wide band (the landscape layout).
 */
export function usesTallOverview(aspect: number, frame: SafeFrame = FULL_FRAME): boolean {
  if (!isPortrait(aspect) || isFullFrame(frame)) return false;
  const shape = frameAspect(aspect, frame);
  return shape >= OVERVIEW.tall.minShape && shape <= OVERVIEW.tall.maxShape;
}

/** Elevation (radians) of the tall view for a free frame of shape `shape` (width / height). */
export function tallElevation(shape: number): number {
  const { elevationDeg, elevationSlopeDeg, elevationShape, minElevation, maxElevation } =
    OVERVIEW.tall;
  const degrees = elevationDeg + (elevationShape - shape) * elevationSlopeDeg;
  return clamp(degToRad(degrees), minElevation, maxElevation);
}

/**
 * Idle sway amplitude (radians) of the home overview for a viewport and free
 * frame: the landscape view's `base`, a smaller one in the tall view, whose
 * steep angle makes the footprint grow quickly when it turns.
 */
export function overviewSwayAmplitude(
  aspect: number,
  frame: SafeFrame = FULL_FRAME,
  base = 0,
): number {
  return usesTallOverview(aspect, frame) ? base * OVERVIEW.tall.swayShare : base;
}

export interface OverviewOptions {
  /** `legacy`: never the tall phone view (system approach sides, configurator limits). */
  layout?: 'auto' | 'legacy';
  /** Viewport size in CSS px (the tall view sizes nodes in px); a phone-sized one when absent. */
  viewport?: { width: number; height: number };
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
  options: OverviewOptions = {},
): CameraGoal {
  const fov = fovForAspect(aspect);
  const { tanV: frameTanV, tanH: frameTanH } = frameTangents(fov, aspect, frame);
  const portrait = usesPortraitOverview(aspect, frame);
  const tall = options.layout !== 'legacy' && usesTallOverview(aspect, frame);
  // Tall view: node sizes on screen come from the viewport's pixels (a phone-sized one when unknown).
  const viewport = options.viewport ?? { width: aspect * 844, height: 844 };
  const tallSizing = tall
    ? {
        minCorePx: minCoreDiameterPx(
          frame.width * viewport.width,
          frame.height * viewport.height,
          false,
          PHONE_CORE_BOOST,
        ),
        pxToTan: (px: number) =>
          (px * 2 * Math.tan((fov * Math.PI) / 360)) / Math.max(viewport.height, 1),
      }
    : null;
  const { elevation, azimuth } = tall
    ? { elevation: tallElevation(frameAspect(aspect, frame)), azimuth: OVERVIEW.tall.azimuth }
    : portrait
      ? OVERVIEW.portrait
      : OVERVIEW.landscape;
  // The tall view's steep angle makes the fit grow fast with the sway: a smaller one.
  const fitSway = tall ? sway * OVERVIEW.tall.swayShare : sway;
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
  const angles = fitSway > 0 ? [0, -fitSway, fitSway, -fitSway / 2, fitSway / 2] : [0];
  const points = framed.flatMap((node) => {
    const { radius, margin, angular } = nodeFraming(node, tallSizing);
    return angles.map((angle) => ({
      p: rotateY(node.position, centroid, angle),
      r: radius,
      angular,
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
    const r = point.r / q.depth + (point.angular ?? 0);
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
  /** Extra extent in tangent units (a size in screen px, independent of the distance). */
  angular?: number;
  tanV: number;
  tanH: number;
}

/**
 * Distance and look target from which every sphere fits its frame tangents,
 * looking along `-dir` (up = +Y): fixed-point iterations that fit the
 * distance, then recentre on the projected extents so the group centres in
 * the frame.
 */
function fitPoints(
  points: readonly FitPoint[],
  dir: Vec3,
  start: Vec3,
  minDistance: number,
  maxDistance: number,
  iterations = 5,
): { look: Vec3; distance: number } {
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const fitDistanceAt = (look: Vec3) => {
    let distance = minDistance;
    for (const { p, r, angular = 0, tanV, tanH } of points) {
      const rel = sub(p, look);
      const x = Math.abs(dot(rel, right)) + r;
      const y = Math.abs(dot(rel, up)) + r;
      // An angular extent grows with the distance too: it narrows the tangents instead.
      const h = Math.max(tanH - angular, tanH * 0.05);
      const v = Math.max(tanV - angular, tanV * 0.05);
      distance = Math.max(distance, Math.max(x / h, y / v) - dot(rel, forward));
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
    for (const { p, r, angular = 0 } of points) {
      const rel = sub(p, look);
      const depth = Math.max(distance + dot(rel, forward), 0.1);
      const x = dot(rel, right) / depth;
      const y = dot(rel, up) / depth;
      minX = Math.min(minX, x - r / depth - angular);
      maxX = Math.max(maxX, x + r / depth + angular);
      minY = Math.min(minY, y - r / depth - angular);
      maxY = Math.max(maxY, y + r / depth + angular);
    }
    if (!Number.isFinite(minX)) break;
    look = add(
      look,
      add(scale(right, ((minX + maxX) / 2) * distance), scale(up, ((minY + maxY) / 2) * distance)),
    );
  }
  return { look, distance };
}

/**
 * Configurator framing (owner feedback round 3, part C): the beacon crystal
 * always sits at the centre of the free frame, on every step and for every
 * selection; the camera never turns toward the selected categories. Each
 * selected category (store `emphasis`, D81) moves the camera back along its
 * viewing direction by `perLink` of the beacon focus distance, at most `max`
 * in total, so the links entering the crystal stay visible (the categories
 * themselves may stay off-screen).
 */
export const CONFIGURATOR_DOLLY = { perLink: 0.07, max: 1.2 } as const;

/**
 * Distance factor of the configurator view for `links` selected categories.
 * Under reduced motion a selection never moves the camera (always 1).
 */
export function configuratorDistanceFactor(links: number, reducedMotion = false): number {
  if (reducedMotion || !(links > 0)) return 1;
  return Math.min(1 + CONFIGURATOR_DOLLY.perLink * Math.floor(links), CONFIGURATOR_DOLLY.max);
}

/** Distinct category nodes of a configurator selection (unknown ids and other kinds ignored). */
export function configuratorLinkCount(
  model: UniverseModel,
  emphasis: readonly string[] | undefined,
): number {
  if (!emphasis?.length) return 0;
  const keys = new Set<string>();
  for (const key of emphasis) {
    if (model.byKey.get(key)?.kind === 'category') keys.add(key);
  }
  return keys.size;
}

/**
 * Camera goal for a URL target. `frame` is the free part of the viewport; the
 * focus is fitted into it (the rig shifts the principal point to its centre).
 * `sway`: idle auto-rotate amplitude the overview fit must cover.
 * `planetAngle`: live orbit angle of the focused planet (planet mode).
 * `emphasis`: configurator selection (store `emphasis`, D81), configurator mode
 * only: dollies the beacon view back (CONFIGURATOR_DOLLY), never under
 * `reducedMotion`.
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
    /** prefers-reduced-motion: a configurator selection never moves the camera. */
    reducedMotion?: boolean;
    /**
     * Centre of the free area (`freeAreaCenter`, viewport fractions): the
     * configurator crystal projects there, even when the frame was widened
     * past a tiny free band. Default: the frame centre.
     */
    freeCenter?: { x: number; y: number };
    /** Planet focus: keeps the chosen viewing side stable while the planet parks. */
    planetView?: PlanetViewMemo;
    /** Viewport in CSS px: the phone's tall overview sizes its nodes on screen. */
    viewport?: { width: number; height: number };
  } = {},
): CameraGoal {
  // Systems, the archive and the beacon are approached from the landscape overview's side
  // and never zoom out past it; only the home view itself may use the tall phone layout.
  const overview = overviewGoal(model, aspect, frame, options.sway ?? 0, { layout: 'legacy' });
  const fov = overview.fov;
  const home = () =>
    usesTallOverview(aspect, frame)
      ? overviewGoal(model, aspect, frame, options.sway ?? 0, { viewport: options.viewport })
      : overview;

  switch (target.mode) {
    case 'system':
    case 'planet': {
      const node = findCategory(model, target.category);
      if (!node) return home();
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
      // The crystal is the look target, so it projects to the free frame's centre (D28) —
      // or to the free band's own centre when the frame had to be widened past it; a
      // selection only dollies the camera back along the same direction.
      const anchor = model.configurator;
      const factor = configuratorDistanceFactor(
        configuratorLinkCount(model, options.emphasis),
        options.reducedMotion,
      );
      const distance = Math.max(fitDistance(4.6, 4.2, fov, aspect, frame), 8.5) * factor;
      const focus = approach(anchor.position, overview.position, distance, fov, 0.18);
      return options.freeCenter ? centreOnPoint(focus, options.freeCenter, aspect, frame) : focus;
    }
    default:
      return home();
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
 * Planet focus framing (visual MJ1, S1, S2). Hard limits first, then taste:
 * - distance: the planet body fills ~42 % of the free frame's short side
 *   (never under 25 % or over 60 %), its reach (rings, moons) fits inside,
 *   and the camera stays ≥ minReach reaches away (well past the near plane);
 * - the camera never stands inside the core's corona or inside any orbit's
 *   tube — the path a planet (with its rings, moons and trail) sweeps along,
 *   the focused planet's own orbit included (S1: a side view along the orbit
 *   put the camera on the planet's trail, in a wash of glow);
 * - among the sides that pass, the first (smallest change from the approach
 *   side) where the core is out of frame or 1.5 planet radii clear wins,
 *   else the one with the least overlap; if no side passes, the camera backs
 *   off step by step.
 */
export const PLANET_VIEW = {
  targetFraction: 0.42,
  minFraction: 0.25,
  maxFraction: 0.6,
  reachFit: 0.85,
  minReach: 2.6,
  minDistance: 0.5,
  /** Camera distance from every orbit path, in that orbit planet's reaches. */
  orbitClearance: 1.6,
  /** Camera distance from the core centre, world units (outside the corona). */
  coreClearance: CORE_CORONA_RADIUS * 1.15,
  /** The focused planet's own orbit is ignored this close to it (radians). */
  ownOrbitSkip: 0.45,
  growth: 1.15,
  orbitSamples: 32,
  /**
   * The view never runs along the orbit: |cos| of the angle between the view
   * direction and the orbit tangent stays under this (S1 mobile: a tangent
   * view saw the dart planet tip-on and its trail stacked into a streak).
   */
  maxTangentCos: 0.8,
} as const;

/** Unit tangent of an orbit at `angle` (world space, direction of increasing angle). */
export function orbitTangent(
  node: CategoryNodeModel,
  orbit: CategoryNodeModel['orbits'][number],
  angle: number,
): Vec3 {
  const ahead = planetWorldPosition(node.position, orbit, angle + 1e-3);
  const behind = planetWorldPosition(node.position, orbit, angle - 1e-3);
  return normalize(sub(ahead, behind));
}

/** Distance range of a planet focus: [start, longest] (see PLANET_VIEW). */
export function planetDistanceRange(
  orbit: CategoryNodeModel['orbits'][number],
  tanShort: number,
): { start: number; longest: number } {
  const reach = planetReach(orbit);
  const start = Math.max(
    orbit.size / (PLANET_VIEW.targetFraction * tanShort),
    reach / (PLANET_VIEW.reachFit * tanShort),
    reach * PLANET_VIEW.minReach,
    PLANET_VIEW.minDistance,
  );
  const longest = Math.max(start, orbit.size / (PLANET_VIEW.minFraction * tanShort));
  return { start, longest };
}

/**
 * How far a camera position is from the forbidden zones of a system (world
 * units; ≥ 0 = allowed): the core's corona and every orbit's tube (orbit
 * path inflated by `orbitClearance` reaches), skipping the stretch of the
 * focused planet's own orbit right around it.
 */
export function planetCameraMargin(
  camera: Vec3,
  node: CategoryNodeModel,
  focused: CategoryNodeModel['orbits'][number],
  angle: number,
): number {
  let margin = Math.hypot(...sub(camera, node.position)) - PLANET_VIEW.coreClearance;
  if (CORE_STYLES[node.core].extra === 'comet-tail') {
    // The comet core's particle tail (S1: a camera inside it sees a wash of particles).
    const end = add(node.position, [...COMET_TAIL_CAPSULE.end]);
    margin = Math.min(
      margin,
      segmentDistance(camera, node.position, end) - COMET_TAIL_CAPSULE.radius,
    );
  }
  const samples = PLANET_VIEW.orbitSamples;
  for (const orbit of node.orbits) {
    const tube = planetReach(orbit) * PLANET_VIEW.orbitClearance;
    const own = orbit === focused;
    for (let k = 0; k < samples; k++) {
      const a = (k / samples) * Math.PI * 2;
      if (own) {
        const delta = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
        if (delta < PLANET_VIEW.ownOrbitSkip) continue;
      }
      const p = planetWorldPosition(node.position, orbit, a);
      margin = Math.min(margin, Math.hypot(...sub(camera, p)) - tube);
      if (margin < -10) return margin;
    }
  }
  return margin;
}

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
  const { tanV, tanH } = frameTangents(fov, aspect, frame);
  const { start, longest } = planetDistanceRange(orbit, Math.min(tanV, tanH));
  const toSystemCamera = normalize(sub(system.position, node.position));
  const outward = normalize(sub(planet, node.position));
  const base = normalize(add(add(toSystemCamera, scale(outward, 0.6)), [0, 0.22, 0]));
  const azimuth = Math.atan2(base[0], base[2]);
  const elevation = Math.asin(clamp(base[1], -1, 1));
  const viewDir = ([yaw, pitch]: readonly [number, number]): Vec3 => {
    const e = clamp(elevation + pitch, -0.9, 1.25);
    const a = azimuth + yaw;
    return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  };
  const cameraAt = (offset: readonly [number, number], distance: number) =>
    add(planet, scale(viewDir(offset), distance));
  const clearance = (offset: readonly [number, number], distance: number) =>
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
  const tangent = orbitTangent(node, orbit, angle);
  const allowed = (offset: readonly [number, number], distance: number) =>
    Math.abs(dot(viewDir(offset), tangent)) <= PLANET_VIEW.maxTangentCos &&
    planetCameraMargin(cameraAt(offset, distance), node, orbit, angle) >= 0;
  const key = `${node.categoryId}/${orbit.serviceSlug}`;
  const remember = (offset: readonly [number, number], distance: number): CameraGoal => {
    if (memo) {
      memo.key = key;
      memo.offset = offset;
    }
    return { position: cameraAt(offset, distance), lookAt: planet, fov };
  };

  // Hysteresis: the previous side stays while it is allowed and clear (cheap while
  // parking). The distance always follows the current frame (S3: a collapsing sheet).
  if (memo?.key === key && memo.offset) {
    if (allowed(memo.offset, start) && clearance(memo.offset, start) >= 1) {
      return remember(memo.offset, start);
    }
  }

  for (let distance = start; ; distance = Math.min(distance * PLANET_VIEW.growth, longest)) {
    let best: readonly [number, number] | null = null;
    let bestScore = -Infinity;
    for (const offset of PLANET_VIEW_OFFSETS) {
      if (!allowed(offset, distance)) continue;
      const score = clearance(offset, distance);
      if (score > bestScore) {
        bestScore = score;
        best = offset;
      }
      if (score >= 1) break;
    }
    if (best) {
      if (memo?.key === key && memo.offset && allowed(memo.offset, distance)) {
        // Keep the previous side while it is nearly as good.
        if (clearance(memo.offset, distance) >= Math.min(bestScore, 1) - 0.1) best = memo.offset;
      }
      return remember(best, distance);
    }
    if (distance >= longest) break;
  }
  // Nothing allowed even at the longest distance: the side with the most room.
  let best: readonly [number, number] = [0, 0];
  let bestMargin = -Infinity;
  for (const offset of PLANET_VIEW_OFFSETS) {
    const margin = planetCameraMargin(cameraAt(offset, longest), node, orbit, angle);
    if (margin > bestMargin) {
      bestMargin = margin;
      best = offset;
    }
  }
  return remember(best, longest);
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
  for (let step = -12; step <= 12; step++) {
    for (const pitch of [0, 0.3, -0.25, 0.6, 0.9]) offsets.push([step * 0.25, pitch]);
  }
  return offsets.sort(
    (a, b) => Math.abs(a[0]) + Math.abs(a[1]) * 1.2 - (Math.abs(b[0]) + Math.abs(b[1]) * 1.2),
  );
})();

export { CORE_KEEP_OUT };

/**
 * How clear the system core is of a planet viewed from `dir` (camera at
 * `planet + dir · distance`, looking at the planet, up = +Y): 1 when the core
 * is outside the frame or at least 1.5 planet radii (`size`) clear of the
 * planet's reach on screen; less when it crowds the planet (0 = touching,
 * negative = overlapping); 0.9 when the core is behind the camera (clear,
 * but the planet is lit from the front, so a side view is preferred).
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
  /** Portrait phones: cores read larger (the network is small on a narrow screen). */
  boost = 1,
): number {
  const short = Math.min(frameWidthPx, frameHeightPx);
  const floor = desktop ? 18 : 12;
  if (!(short > 0)) return Math.max(20, floor) * boost;
  return clamp(short * 0.05, floor, 30) * boost;
}

/** Core size boost on portrait phones (B1: "nodes larger"): 20 px → 26 px on a 390 px screen. */
export const PHONE_CORE_BOOST = 1.3;

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

/** Distance from `p` to the segment [a, b]. */
function segmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = sub(b, a);
  const t = clamp(dot(sub(p, a), ab) / Math.max(dot(ab, ab), 1e-9), 0, 1);
  return Math.hypot(...sub(p, add(a, scale(ab, t))));
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
