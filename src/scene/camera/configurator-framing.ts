import { degToRad } from '../orbit-math';
import type { Vec3 } from '../types';
import {
  labelExtents,
  labelReticle,
  LABEL_METRICS,
  type LabelSide,
} from '../universe/label-layout';
import { bowControlPoint } from '../universe/network-model';
import type { SafeFrame } from './goals';

/**
 * Configurator framing with connections (owner feedback round 5, part B).
 * Pure and three-free. With at least one selected category the camera frames
 * the beacon crystal together with every selected category node — their
 * halos and their labels included — inside the free zone (the safe rect,
 * with CONFIGURATOR_FRAMING.margin per side), seen from slightly above. The
 * azimuth is one of `azimuthCount` candidates: the one where the selection
 * links (node → crystal) do not overlap on screen and the closest node is
 * farthest from the crystal on screen; a new best must beat the current one
 * by `hysteresis` or the camera keeps its side. The distance is clamped
 * between the crystal close-up and the universe overview.
 */
export const CONFIGURATOR_FRAMING = {
  /** Elevation of the view, radians (slightly from above). */
  elevation: degToRad(25),
  /** Azimuth candidates, evenly spaced (every 45°). */
  azimuthCount: 8,
  /** Margin of the free zone kept clear on every side (share of its width / height). */
  margin: 0.12,
  /** A new azimuth must beat the current one by this share, or the current one stays. */
  hysteresis: 0.15,
  /** Idle sway amplitude of the framed view (radians); the fit covers it. */
  sway: 0.05,
  /** Visible radius of a selected node's halo per core diameter (Halo: 6.2 × 1.13 × ½). */
  haloPerCore: 1.75,
  /** Two links closer than this on screen (CSS px, crystal end excluded) overlap. */
  linkGapPx: 10,
  /** Share of each link (from its node) checked for overlap: the crystal end always meets. */
  linkReach: 0.8,
  /** Straight pieces per link on screen (overlap and label checks). */
  linkSamples: 10,
  /**
   * Label placements are searched exhaustively (side and rise, 4^n) up to
   * `labelSearchFull` nodes, sides only (2^n) up to `labelSearchMax`, else
   * every label hangs outward from the crystal.
   */
  labelSearchFull: 3,
  labelSearchMax: 4,
  /** A tidy label placement (text off the links and unselected cores) may cost this much more distance. */
  labelLinkSlack: 0.15,
  /** Free zones lower than this (CSS px) cannot hold labels: crystal and cores only. */
  bandMaxPx: 120,
  /**
   * An unselected node on screen closer than this many halo radii to the
   * crystal or to a selected node crowds it (it reads as connected too).
   */
  clutterHalos: 3,
  /** Nearest allowed view depth of a framed object, world units. */
  nearDepth: 1,
} as const;

/** Something the framing keeps inside the free zone. */
export interface FramingSubject {
  key: string;
  position: Vec3;
  /** World radius it occupies (glow and orbit preview at their true scale). */
  radius: number;
  /** Screen radius it occupies at its minimum on-screen size, CSS px. */
  radiusPx: number;
  /** On-screen core diameter, CSS px (label reticle and label obstacles). */
  corePx: number;
  /** Text block of its label (CSS px), or null: no label. */
  label: { width: number; height: number } | null;
  /** How far its centre wanders (ambient drift), world units; 0 when absent. */
  drift?: number;
}

export interface ConfiguratorFramingInput {
  crystal: FramingSubject;
  /** Selected category nodes (at least one). */
  nodes: readonly FramingSubject[];
  /**
   * Every other universe node (unselected categories, portfolio) with its
   * on-screen core diameter (CSS px): kept off the subjects and the labels.
   */
  others?: ReadonlyArray<{ position: Vec3; corePx: number }>;
  /** Vertical FOV of the full viewport, degrees, and the viewport in CSS px. */
  fov: number;
  viewport: { width: number; height: number };
  /** Frame whose centre is the principal point (resolveSafeFrame). */
  frame: SafeFrame;
  /** The free zone itself (viewport fractions, never widened). */
  free: SafeFrame;
  /** Free-zone margin for the objects (share per side) and the inset for label text (px). */
  margin: number;
  labelInsetPx: number;
  /**
   * Distance bounds: crystal close-up (the camera never comes closer to the
   * crystal or to the look target) and universe overview (never farther from
   * the group's mean depth, where the look target is, unless that conflicts
   * with the close-up bound).
   */
  minDistance: number;
  maxDistance: number;
  /** Idle sway (radians) the fit must cover. */
  sway: number;
}

export interface LabelPlacement extends LabelSide {
  key: string;
}

export interface FramingCandidate {
  index: number;
  azimuth: number;
  position: Vec3;
  lookAt: Vec3;
  /** Camera to look target, world units. */
  distance: number;
  /** Everything fits inside the free zone within the distance bounds. */
  fits: boolean;
  /** No two links overlap on screen. */
  linksClear: boolean;
  /** No label box overlaps another one or a core. */
  labelsClear: boolean;
  /** No unselected node crowds the crystal or a selected node on screen (`clutterHalos`). */
  othersClear: boolean;
  /** No label text lies over a link line or over an unselected node's core. */
  labelsTidy: boolean;
  /** Selected nodes whose core is inside the free zone. */
  visible: number;
  /** Smallest on-screen distance between the crystal and a node, CSS px. */
  score: number;
  /** Smallest on-screen gap between two links, CSS px (Infinity with one link). */
  linkGapPx: number;
  labels: LabelPlacement[];
}

/** Configurator view chosen last time (hysteresis); owned by the camera director. */
export interface ConfiguratorViewMemo {
  index?: number;
  labels?: readonly LabelPlacement[];
  candidate?: FramingCandidate;
  /** The last framing was for a free zone too low for labels (cores only). */
  band?: boolean;
}

/** Azimuth (radians) of candidate `index`. */
export function framingAzimuth(index: number): number {
  return (index / CONFIGURATOR_FRAMING.azimuthCount) * Math.PI * 2;
}

/** Candidate whose azimuth is closest to `azimuth` (radians). */
export function nearestAzimuthIndex(azimuth: number): number {
  const count = CONFIGURATOR_FRAMING.azimuthCount;
  const step = (Math.PI * 2) / count;
  return (((Math.round(azimuth / step) % count) + count) % count) as number;
}

/**
 * Picks a candidate: the best ranked one (`compareCandidates`), unless the
 * current one is in the same tier and the best beats its score by less than
 * the hysteresis share — then the current one stays (the camera does not sway).
 */
export function chooseCandidate(
  candidates: readonly FramingCandidate[],
  current?: number,
  hysteresis: number = CONFIGURATOR_FRAMING.hysteresis,
): number {
  let best = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (compareCandidates(candidates[i]!, candidates[best]!) > 0) best = i;
  }
  const kept = current === undefined ? undefined : candidates[current];
  if (kept && kept !== candidates[best]) {
    const winner = candidates[best]!;
    if (compareTiers(kept, winner) === 0 && winner.score < kept.score * (1 + hysteresis)) {
      return current!;
    }
  }
  return best;
}

/**
 * Ranking: valid (fits, links clear, labels clear) first; then — for the
 * free zones where nothing fits, e.g. a phone band of a few dozen px — the
 * most selected nodes inside it; then no unselected node crowding them; then
 * the largest crystal-to-node distance.
 */
export function compareCandidates(a: FramingCandidate, b: FramingCandidate): number {
  return compareTiers(a, b) || a.score - b.score;
}

function compareTiers(a: FramingCandidate, b: FramingCandidate): number {
  const tier = (c: FramingCandidate) => [
    c.fits && c.linksClear && c.labelsClear ? 1 : 0,
    c.fits ? 1 : 0,
    c.visible,
    c.othersClear ? 1 : 0,
    c.linksClear ? 1 : 0,
    c.labelsClear ? 1 : 0,
  ];
  const ta = tier(a);
  const tb = tier(b);
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) return ta[i]! - tb[i]!;
  }
  return 0;
}

/** Fits the subjects from every candidate azimuth (see CONFIGURATOR_FRAMING). */
export function framingCandidates(input: ConfiguratorFramingInput): FramingCandidate[] {
  const candidates: FramingCandidate[] = [];
  for (let index = 0; index < CONFIGURATOR_FRAMING.azimuthCount; index++) {
    candidates.push(frameFrom(input, index));
  }
  return candidates;
}

/**
 * The configurator view with connections: every candidate is fitted, one is
 * chosen with hysteresis against `memo.index` (or, on the first framing,
 * against the candidate nearest `seedAzimuth`, the side the camera looks
 * from now), and the memo is updated with the choice and its label sides.
 */
export function frameConfigurator(
  input: ConfiguratorFramingInput,
  memo?: ConfiguratorViewMemo,
  seedAzimuth?: number,
  /**
   * Re-solve only the current azimuth with its label sides (the free zone is
   * changing continuously: a sheet drag, a window resize); the caller runs a
   * full search once it is quiet. Falls back to the full search without a memo.
   */
  quick = false,
): FramingCandidate {
  const kept = memo?.labels;
  if (
    quick &&
    memo?.index !== undefined &&
    kept &&
    kept.length === input.nodes.length &&
    kept.every((placement, i) => placement.key === input.nodes[i]!.key)
  ) {
    const candidate = frameFrom(input, memo.index, kept);
    memo.labels = candidate.labels;
    memo.candidate = candidate;
    return candidate;
  }
  const candidates = framingCandidates(input);
  const current =
    memo?.index ?? (seedAzimuth === undefined ? undefined : nearestAzimuthIndex(seedAzimuth));
  const chosen = candidates[chooseCandidate(candidates, current)]!;
  if (memo) {
    memo.index = chosen.index;
    memo.labels = chosen.labels;
    memo.candidate = chosen;
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Fit from one azimuth                                                */
/* ------------------------------------------------------------------ */

interface Basis {
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

/** Window in tangent units around the principal point (y up). */
interface Window {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * One constraint source: a centre in camera-basis coordinates (r, u, f), a
 * world radius and a box of tangent offsets (a size in screen px, the same at
 * any distance), kept inside `win`.
 */
interface FitItem {
  r: number;
  u: number;
  f: number;
  radius: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  win: Window;
  /** Subject index (0 = crystal, 1… = nodes) and whether it is that subject's label. */
  owner: number;
  label: boolean;
}

interface Solution {
  cr: number;
  cu: number;
  cf: number;
  fits: boolean;
}

interface Projection {
  /** CSS px per tangent unit, and the principal point in px. */
  pxPerTan: number;
  originX: number;
  originY: number;
}

function frameFrom(
  input: ConfiguratorFramingInput,
  index: number,
  fixed?: readonly LabelSide[],
): FramingCandidate {
  const azimuth = framingAzimuth(index);
  const basis = basisFor(azimuth, CONFIGURATOR_FRAMING.elevation);
  const tan = Math.tan((input.fov * Math.PI) / 360);
  const viewportHeight = Math.max(input.viewport.height, 1);
  const viewportWidth = Math.max(input.viewport.width, 1);
  const k = (2 * tan) / viewportHeight;
  const projection: Projection = {
    pxPerTan: 1 / k,
    originX: (input.frame.x + input.frame.width / 2) * viewportWidth,
    originY: (input.frame.y + input.frame.height / 2) * viewportHeight,
  };
  const toX = (u: number) => (u * viewportWidth - projection.originX) * k;
  const toY = (v: number) => -(v * viewportHeight - projection.originY) * k;
  const free = input.free;
  const objectWindow: Window = {
    xMin: toX(free.x + input.margin * free.width),
    xMax: toX(free.x + (1 - input.margin) * free.width),
    yMin: toY(free.y + (1 - input.margin) * free.height),
    yMax: toY(free.y + input.margin * free.height),
  };
  const insetX = input.labelInsetPx / viewportWidth;
  const insetY = input.labelInsetPx / viewportHeight;
  const labelWindow: Window = {
    xMin: toX(free.x + insetX),
    xMax: toX(free.x + free.width - insetX),
    yMin: toY(free.y + free.height - insetY),
    yMax: toY(free.y + insetY),
  };

  const subjects = [input.crystal, ...input.nodes];
  const centroid = scale(
    subjects.reduce<Vec3>((sum, subject) => add(sum, subject.position), [0, 0, 0]),
    1 / subjects.length,
  );
  const meanF =
    subjects.reduce((sum, s) => sum + dot(s.position, basis.forward), 0) / subjects.length;
  const crystalF = dot(input.crystal.position, basis.forward);
  const minF = Math.min(...subjects.map((s) => dot(s.position, basis.forward)));
  const cfNear = Math.min(
    crystalF - input.minDistance,
    meanF - input.minDistance,
    minF - CONFIGURATOR_FRAMING.nearDepth,
  );
  const cfFar = Math.min(meanF - input.maxDistance, cfNear);

  // Outward label sides from a provisional view (they barely depend on the distance).
  const provisional = (s: FramingSubject): { x: number; y: number } => {
    const depth = Math.max(dot(s.position, basis.forward) - (meanF - input.maxDistance), 1e-3);
    return { x: dot(s.position, basis.right) / depth, y: dot(s.position, basis.up) / depth };
  };
  const crystalAt = provisional(input.crystal);
  const outward: LabelSide[] = input.nodes.map((node) => {
    const at = provisional(node);
    return { side: at.x >= crystalAt.x ? 1 : -1, rise: at.y >= crystalAt.y ? 1 : -1 };
  });

  const swayAngles = input.sway > 0 ? [0, -input.sway, input.sway] : [0];
  const objectItems: FitItem[] = [];
  for (const angle of swayAngles) {
    subjects.forEach((subject, owner) => {
      const p = rotateY(subject.position, centroid, angle);
      const drift = subject.drift ?? 0;
      // Extent = max(world radius, px radius) around a drifting centre: one item for each.
      objectItems.push(item(p, basis, subject.radius + drift, 0, objectWindow, owner));
      objectItems.push(item(p, basis, drift, subject.radiusPx * k, objectWindow, owner));
    });
  }

  // Label placements: outward first; then every side combination (outward rise) for
  // up to `labelSearchMax` nodes; then every side/rise combination for up to
  // `labelSearchFull` nodes.
  const labelled = input.nodes.filter((node) => node.label);
  const n = input.nodes.length;
  const flipped = (mask: number, bits: 1 | 2): LabelSide[] =>
    outward.map((placement, i) => {
      const flipSide = (mask >> (i * bits)) & 1;
      const flipRise = bits === 2 ? (mask >> (i * bits + 1)) & 1 : 0;
      return {
        side: flipSide ? (placement.side > 0 ? -1 : 1) : placement.side,
        rise: flipRise ? (placement.rise > 0 ? -1 : 1) : placement.rise,
      };
    });
  const rounds: Array<() => LabelSide[][]> = [
    () => [fixed ? fixed.map(({ side, rise }) => ({ side, rise })) : outward],
  ];
  if (!fixed && labelled.length > 0) {
    if (n <= CONFIGURATOR_FRAMING.labelSearchMax) {
      rounds.push(() => Array.from({ length: (1 << n) - 1 }, (_, m) => flipped(m + 1, 1)));
    }
    if (n <= CONFIGURATOR_FRAMING.labelSearchFull) {
      // Side-only masks were tried already: only those that flip a rise.
      rounds.push(() =>
        Array.from({ length: (1 << (2 * n)) - 1 }, (_, m) => m + 1)
          .filter((mask) => {
            for (let i = 0; i < n; i++) if ((mask >> (2 * i + 1)) & 1) return true;
            return false;
          })
          .map((mask) => flipped(mask, 2)),
      );
    }
  }

  // The combination kept (betterLabels): labels clear first, then fitting, then the
  // closest camera (the largest picture) — unless a tidy one (text off the link lines
  // and the unselected cores) is nearly as close; ties keep the earlier one (outward
  // sides first).
  const centreX = toX(free.x + free.width / 2);
  const centreY = toY(free.y + free.height / 2);
  const lines = labelled.length > 0 ? linkLines(input, basis) : null;
  let best: {
    solution: Solution;
    sides: LabelSide[];
    labelsClear: boolean;
    tidy: boolean;
  } | null = null;
  const items = [...objectItems];
  /** The object items plus the label items for `sides` (in `items`, reused). */
  const itemsFor = (sides: readonly LabelSide[]) => {
    // Label items follow their node (the sway covered by the label inset).
    items.length = objectItems.length;
    input.nodes.forEach((node, i) => {
      if (!node.label) return;
      const { whole } = labelExtents(
        node.corePx / 2,
        node.label.width,
        node.label.height,
        sides[i]!,
      );
      items.push({
        ...item(node.position, basis, node.drift ?? 0, 0, labelWindow, i + 1, true),
        x0: whole.left * k,
        x1: whole.right * k,
        y0: -whole.bottom * k,
        y1: -whole.top * k,
      });
    });
    return items;
  };
  for (const round of rounds) {
    for (const sides of round()) {
      const solution = solve(itemsFor(sides), cfNear, cfFar, centreX, centreY);
      const boxes = labelBoxes(input, basis, solution, projection, sides);
      const labelsClear = labelsAreClear(input, basis, solution, projection, boxes);
      // Only matters between combinations that are clear and fit.
      const tidy =
        !lines ||
        (labelsClear &&
          solution.fits &&
          labelsTidy(
            input,
            basis,
            solution,
            projection,
            boxes,
            projectLines(lines, solution, projection),
          ));
      const next = { solution, sides, labelsClear, tidy };
      if (!best) {
        best = next;
        continue;
      }
      if (betterLabels(next, best, meanF)) best = next;
    }
  }

  // Nothing fits (a band of a few dozen px): place the kept combination so the crystal
  // stays inside with as many nodes as possible.
  if (!best!.solution.fits) {
    const solution = solve(itemsFor(best!.sides), cfNear, cfFar, centreX, centreY, true);
    const boxes = labelBoxes(input, basis, solution, projection, best!.sides);
    best = {
      ...best!,
      solution,
      labelsClear: labelsAreClear(input, basis, solution, projection, boxes),
    };
  }
  const { solution, sides, labelsClear, tidy } = best!;
  const project = (p: Vec3) => projectPx(p, basis, solution, projection);
  const crystalPx = project(input.crystal.position);
  let score = Infinity;
  let visible = 0;
  const freePx = {
    left: free.x * viewportWidth,
    right: (free.x + free.width) * viewportWidth,
    top: free.y * viewportHeight,
    bottom: (free.y + free.height) * viewportHeight,
  };
  for (const node of input.nodes) {
    const at = project(node.position);
    score = Math.min(score, Math.hypot(at.x - crystalPx.x, at.y - crystalPx.y));
    const core = node.corePx / 2;
    if (
      at.x - core >= freePx.left - 1 &&
      at.x + core <= freePx.right + 1 &&
      at.y - core >= freePx.top - 1 &&
      at.y + core <= freePx.bottom + 1
    ) {
      visible++;
    }
  }
  // Unselected nodes on screen (inside the free zone) keep their distance from the subjects.
  const crowd =
    CONFIGURATOR_FRAMING.clutterHalos * Math.max(...input.nodes.map((node) => node.radiusPx));
  const subjectsPx = subjects.map((subject) => project(subject.position));
  let othersClear = true;
  for (const other of input.others ?? []) {
    const at = project(other.position);
    if (at.z <= CONFIGURATOR_FRAMING.nearDepth) continue;
    if (at.x < freePx.left || at.x > freePx.right || at.y < freePx.top || at.y > freePx.bottom) {
      continue;
    }
    if (subjectsPx.some((s) => Math.hypot(at.x - s.x, at.y - s.y) < crowd)) {
      othersClear = false;
      break;
    }
  }
  const linkGapPx = linkGap(projectLines(lines ?? linkLines(input, basis), solution, projection));
  const position = add(
    add(scale(basis.right, solution.cr), scale(basis.up, solution.cu)),
    scale(basis.forward, solution.cf),
  );
  // Look target on the view axis at the group's mean depth (the orbit pivot), within the bounds.
  const distance = clamp(meanF - solution.cf, input.minDistance, input.maxDistance);
  return {
    index,
    azimuth,
    position,
    lookAt: add(position, scale(basis.forward, distance)),
    distance,
    fits: solution.fits,
    linksClear: linkGapPx >= CONFIGURATOR_FRAMING.linkGapPx,
    labelsClear,
    othersClear,
    labelsTidy: tidy,
    visible,
    score: Number.isFinite(score) ? score : 0,
    linkGapPx,
    labels: input.nodes.map((node, i) => ({ key: node.key, ...sides[i]! })),
  };
}

/**
 * Whether label placement `a` beats `b`: clear labels, then fitting, then
 * the closer camera — but a tidy placement (`labelsTidy`) wins when its
 * camera is at most `labelLinkSlack` farther.
 */
function betterLabels(
  a: { solution: Solution; labelsClear: boolean; tidy: boolean },
  b: { solution: Solution; labelsClear: boolean; tidy: boolean },
  meanF: number,
): boolean {
  if (a.labelsClear !== b.labelsClear) return a.labelsClear;
  if (a.solution.fits !== b.solution.fits) return a.solution.fits;
  const da = meanF - a.solution.cf;
  const db = meanF - b.solution.cf;
  if (a.tidy !== b.tidy) {
    const [clean, other] = a.tidy ? [da, db] : [db, da];
    const cleanWins = clean <= other * (1 + CONFIGURATOR_FRAMING.labelLinkSlack);
    return cleanWins === a.tidy;
  }
  return da < db - 1e-6;
}

function item(
  p: Vec3,
  basis: Basis,
  radius: number,
  angular: number,
  win: Window,
  owner: number,
  label = false,
): FitItem {
  return {
    r: dot(p, basis.right),
    u: dot(p, basis.up),
    f: dot(p, basis.forward),
    radius,
    x0: -angular,
    x1: angular,
    y0: -angular,
    y1: angular,
    win,
    owner,
    label,
  };
}

interface Intervals {
  lowR: number;
  highR: number;
  lowU: number;
  highU: number;
}

/**
 * Feasible camera offsets (right / up, basis coordinates) at camera depth
 * `cf`: every item's projected extent inside its window is linear in them.
 */
function intervals(items: readonly FitItem[], cf: number, crystalOnly: boolean): Intervals {
  let lowR = -Infinity;
  let highR = Infinity;
  let lowU = -Infinity;
  let highU = Infinity;
  for (const it of items) {
    if (crystalOnly && it.owner !== 0) continue;
    const z = it.f - cf;
    lowR = Math.max(lowR, it.r + it.radius - (it.win.xMax - it.x1) * z);
    highR = Math.min(highR, it.r - it.radius - (it.win.xMin - it.x0) * z);
    lowU = Math.max(lowU, it.u + it.radius - (it.win.yMax - it.y1) * z);
    highU = Math.min(highU, it.u - it.radius - (it.win.yMin - it.y0) * z);
  }
  return { lowR, highR, lowU, highU };
}

function feasible(items: readonly FitItem[], cf: number): boolean {
  const { lowR, highR, lowU, highU } = intervals(items, cf, false);
  return lowR <= highR && lowU <= highU;
}

/**
 * Closest camera depth (`cf`, along the view) from which every item fits,
 * within [cfFar, cfNear]; then the lateral offsets that centre the box of all
 * items on the free zone's centre (cx, cy, tangent units), kept feasible.
 * When nothing fits even at cfFar, the crystal is kept inside instead and —
 * with `scan` — at the offsets (scanned across its allowed range) that keep
 * the most nodes inside.
 */
function solve(
  items: readonly FitItem[],
  cfNear: number,
  cfFar: number,
  cx: number,
  cy: number,
  /** When nothing fits: scan the crystal's range for the most nodes inside. */
  scan = false,
): Solution {
  let cf: number;
  let fits = true;
  if (feasible(items, cfNear)) {
    cf = cfNear;
  } else if (!feasible(items, cfFar)) {
    cf = cfFar;
    fits = false;
  } else {
    let lo = cfFar;
    let hi = cfNear;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (feasible(items, mid)) lo = mid;
      else hi = mid;
    }
    cf = lo;
  }
  const all = intervals(items, cf, false);
  const crystal = intervals(items, cf, true);
  const centre = (axis: 'r' | 'u') => {
    let c = items.reduce((sum, it) => sum + (axis === 'r' ? it.r : it.u), 0) / items.length;
    const depth = items.reduce((sum, it) => sum + (it.f - cf), 0) / items.length;
    for (let i = 0; i < 12; i++) {
      let min = Infinity;
      let max = -Infinity;
      for (const it of items) {
        const z = it.f - cf;
        const value = ((axis === 'r' ? it.r : it.u) - c) / z;
        const radius = it.radius / z;
        min = Math.min(min, value - radius + (axis === 'r' ? it.x0 : it.y0));
        max = Math.max(max, value + radius + (axis === 'r' ? it.x1 : it.y1));
      }
      const offset = (min + max) / 2 - (axis === 'r' ? cx : cy);
      if (Math.abs(offset) < 1e-9) break;
      c += offset * depth;
    }
    const low = axis === 'r' ? all.lowR : all.lowU;
    const high = axis === 'r' ? all.highR : all.highU;
    if (low <= high) return clamp(c, low, high);
    const cLow = axis === 'r' ? crystal.lowR : crystal.lowU;
    const cHigh = axis === 'r' ? crystal.highR : crystal.highU;
    // Not even the crystal fits: centre it (its overflow split evenly).
    return cLow <= cHigh ? clamp(c, cLow, cHigh) : (cLow + cHigh) / 2;
  };
  let cr = centre('r');
  let cu = centre('u');
  if (!fits && scan) {
    const range = (low: number, high: number, preferred: number) => {
      if (!(low <= high)) return [preferred];
      const steps = 12;
      const values = [preferred];
      for (let i = 0; i <= steps; i++) values.push(low + ((high - low) * i) / steps);
      return values;
    };
    const rs = range(crystal.lowR, crystal.highR, cr);
    const us = range(crystal.lowU, crystal.highU, cu);
    let bestCount = insideCount(items, cr, cu, cf);
    let bestShift = 0;
    for (const r of rs) {
      for (const u of us) {
        const count = insideCount(items, r, u, cf);
        const shift = Math.hypot(r - rs[0]!, u - us[0]!);
        if (count > bestCount || (count === bestCount && shift < bestShift)) {
          bestCount = count;
          bestShift = shift;
          cr = r;
          cu = u;
        }
      }
    }
  }
  return { cr, cu, cf, fits };
}

/** Nodes (not the crystal, labels ignored) whose every item fits at the camera (cr, cu, cf). */
function insideCount(items: readonly FitItem[], cr: number, cu: number, cf: number): number {
  const out = new Set<number>();
  const seen = new Set<number>();
  for (const it of items) {
    if (it.owner === 0 || it.label) continue;
    seen.add(it.owner);
    const z = it.f - cf;
    const x = (it.r - cr) / z;
    const y = (it.u - cu) / z;
    const radius = it.radius / z;
    if (
      x - radius + it.x0 < it.win.xMin ||
      x + radius + it.x1 > it.win.xMax ||
      y - radius + it.y0 < it.win.yMin ||
      y + radius + it.y1 > it.win.yMax
    ) {
      out.add(it.owner);
    }
  }
  return seen.size - out.size;
}

function projectPx(
  p: Vec3,
  basis: Basis,
  solution: Solution,
  projection: Projection,
): { x: number; y: number; z: number } {
  const z = dot(p, basis.forward) - solution.cf;
  const depth = Math.max(z, 1e-3);
  return {
    x: projection.originX + ((dot(p, basis.right) - solution.cr) / depth) * projection.pxPerTan,
    y: projection.originY - ((dot(p, basis.up) - solution.cu) / depth) * projection.pxPerTan,
    z,
  };
}

type Box = { left: number; top: number; right: number; bottom: number };

/** Label text boxes (CSS px) as NodeLabels lays them out on the given sides; null: no label. */
function labelBoxes(
  input: ConfiguratorFramingInput,
  basis: Basis,
  solution: Solution,
  projection: Projection,
  sides: readonly LabelSide[],
): Array<Box | null> {
  return input.nodes.map((node, i) => {
    if (!node.label) return null;
    const at = projectPx(node.position, basis, solution, projection);
    const { text } = labelExtents(node.corePx / 2, node.label.width, node.label.height, sides[i]!);
    return {
      left: at.x + text.left,
      right: at.x + text.right,
      top: at.y + text.top,
      bottom: at.y + text.bottom,
    };
  });
}

/** Label text boxes clear of each other and of every framed core (as NodeLabels lays them out). */
function labelsAreClear(
  input: ConfiguratorFramingInput,
  basis: Basis,
  solution: Solution,
  projection: Projection,
  boxes: ReadonlyArray<Box | null>,
): boolean {
  // Selected nodes show their reticle around the core: the text keeps off it too.
  const cores = [input.crystal, ...input.nodes].map((s, i) => ({
    key: s.key,
    at: projectPx(s.position, basis, solution, projection),
    r: i === 0 ? s.corePx / 2 + LABEL_METRICS.obstaclePadding : labelReticle(s.corePx / 2) + 2,
  }));
  const pad = LABEL_METRICS.boxPadding;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box) continue;
    for (const core of cores) {
      if (core.key === input.nodes[i]!.key) continue;
      const nx = clamp(core.at.x, box.left, box.right);
      const ny = clamp(core.at.y, box.top, box.bottom);
      if (Math.hypot(core.at.x - nx, core.at.y - ny) < core.r) return false;
    }
    for (let j = 0; j < i; j++) {
      const other = boxes[j];
      if (
        other &&
        box.left < other.right + pad &&
        box.right > other.left - pad &&
        box.top < other.bottom + pad &&
        box.bottom > other.top - pad
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * No label text over a link line (its own included) or over the core of an
 * unselected node (NodeLabels keeps the text off those cores too).
 */
function labelsTidy(
  input: ConfiguratorFramingInput,
  basis: Basis,
  solution: Solution,
  projection: Projection,
  boxes: ReadonlyArray<Box | null>,
  lines: ReadonlyArray<readonly Point2[]> | null,
): boolean {
  for (const other of input.others ?? []) {
    const at = projectPx(other.position, basis, solution, projection);
    if (at.z <= CONFIGURATOR_FRAMING.nearDepth) continue;
    const r = other.corePx / 2 + LABEL_METRICS.obstaclePadding;
    for (const box of boxes) {
      if (!box) continue;
      const nx = clamp(at.x, box.left, box.right);
      const ny = clamp(at.y, box.top, box.bottom);
      if (Math.hypot(at.x - nx, at.y - ny) < r) return false;
    }
  }
  if (!lines) return true;
  const pad = 2;
  for (const box of boxes) {
    if (!box) continue;
    const b = {
      left: box.left - pad,
      right: box.right + pad,
      top: box.top - pad,
      bottom: box.bottom + pad,
    };
    for (const line of lines) {
      for (let i = 0; i + 1 < line.length; i++) {
        if (segmentHitsBox(line[i]!, line[i + 1]!, b)) return false;
      }
    }
  }
  return true;
}

function segmentHitsBox(a: Point2, b: Point2, box: Box): boolean {
  // Most segments are nowhere near the box.
  if (
    Math.max(a.x, b.x) < box.left ||
    Math.min(a.x, b.x) > box.right ||
    Math.max(a.y, b.y) < box.top ||
    Math.min(a.y, b.y) > box.bottom
  ) {
    return false;
  }
  const inside = (p: Point2) =>
    p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom;
  if (inside(a) || inside(b)) return true;
  // Both ends outside: it crosses the box iff it crosses one of the box's diagonals.
  const tl = { x: box.left, y: box.top };
  const br = { x: box.right, y: box.bottom };
  const tr = { x: box.right, y: box.top };
  const bl = { x: box.left, y: box.bottom };
  return segmentGap(a, b, tl, br) === 0 || segmentGap(a, b, tr, bl) === 0;
}

/** Selection links in world space (bowed like SelectionLinks), node (u = 0) to crystal (u = 1). */
function linkLines(
  input: ConfiguratorFramingInput,
  basis: Basis,
): Array<Array<[number, number, number]>> {
  const { linkSamples } = CONFIGURATOR_FRAMING;
  const end = input.crystal.position;
  return input.nodes.map((node) => {
    const start = node.position;
    const control = bowControlPoint(start, end);
    const points: Array<[number, number, number]> = [];
    for (let s = 0; s <= linkSamples; s++) {
      const u = s / linkSamples;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      const p: Vec3 = [
        a * start[0] + b * control[0] + c * end[0],
        a * start[1] + b * control[1] + c * end[1],
        a * start[2] + b * control[2] + c * end[2],
      ];
      // Camera-basis coordinates: projecting them for a camera is two divisions.
      points.push([dot(p, basis.right), dot(p, basis.up), dot(p, basis.forward)]);
    }
    return points;
  });
}

/** The links on screen for a solved camera, CSS px. */
function projectLines(
  lines: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>>,
  solution: Solution,
  projection: Projection,
): Point2[][] {
  return lines.map((line) =>
    line.map(([r, u, f]) => {
      const depth = Math.max(f - solution.cf, 1e-3);
      return {
        x: projection.originX + ((r - solution.cr) / depth) * projection.pxPerTan,
        y: projection.originY - ((u - solution.cu) / depth) * projection.pxPerTan,
      };
    }),
  );
}

/**
 * Smallest on-screen gap between two links, CSS px, over the part of each
 * link away from the crystal (`linkReach`): they always meet at the crystal.
 */
function linkGap(lines: ReadonlyArray<readonly Point2[]>): number {
  if (lines.length < 2) return Infinity;
  const { linkReach, linkSamples } = CONFIGURATOR_FRAMING;
  const count = Math.floor(linkReach * linkSamples + 1e-9) + 1;
  let gap = Infinity;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      gap = Math.min(gap, polylineDistance(lines[i]!.slice(0, count), lines[j]!.slice(0, count)));
    }
  }
  return gap;
}

type Point2 = { x: number; y: number };

function polylineDistance(a: readonly Point2[], b: readonly Point2[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < a.length; i++) {
    for (let j = 0; j + 1 < b.length; j++) {
      best = Math.min(best, segmentGap(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!));
    }
  }
  return best;
}

/** Distance between two 2D segments (0 when they cross). */
function segmentGap(p1: Point2, p2: Point2, q1: Point2, q2: Point2): number {
  const d1 = cross2(q1, q2, p1);
  const d2 = cross2(q1, q2, p2);
  const d3 = cross2(p1, p2, q1);
  const d4 = cross2(p1, p2, q2);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    pointSegment(p1, q1, q2),
    pointSegment(p2, q1, q2),
    pointSegment(q1, p1, p2),
    pointSegment(q2, p1, p2),
  );
}

function cross2(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function basisFor(azimuth: number, elevation: number): Basis {
  const dir: Vec3 = [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ];
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return { right, up, forward };
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

function scale(v: Vec3, factor: number): Vec3 {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}
