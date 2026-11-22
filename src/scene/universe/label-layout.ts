/**
 * Placement of the hover label (pure, three-free). The label hangs off a
 * leader line that leaves the node's reticle diagonally and then runs
 * horizontally under (or over) the text (art direction: leader lines,
 * reticle). Candidates, in order: right-up, right-down, left-up, left-down
 * (a preferred placement, when given, is tried first); the first whose text
 * box stays inside the free area and clear of the other nodes' cores and of
 * the other labels' boxes wins. If none fits at the normal letter-spacing,
 * the compact spacing is tried; as a last resort the best candidate is
 * clamped inside the free area (visual V2-03, V2-04).
 */
export interface LabelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A screen disc to keep the text off (another node's core). */
export interface LabelObstacle {
  x: number;
  y: number;
  r: number;
}

/** Where a label hangs off its node: 1 = right / up, -1 = left / down. */
export interface LabelSide {
  side: 1 | -1;
  rise: 1 | -1;
}

export interface LabelInput {
  /** Node centre, CSS px. */
  x: number;
  y: number;
  coreRadiusPx: number;
  /** Text block size at normal and compact letter-spacing. */
  textWidth: number;
  compactWidth: number;
  textHeight: number;
  /** Free area, already inset by the caller's margin. */
  bounds: LabelBounds;
  obstacles: readonly LabelObstacle[];
  /** Boxes to keep the text off (labels already placed), CSS px. */
  boxes?: readonly LabelBounds[];
  /** Placement tried first (the configurator framing reserved room for it). */
  prefer?: LabelSide | null;
}

export interface LabelLayout {
  /** 1 = label to the right of the node, -1 = to the left. */
  side: 1 | -1;
  /** 1 = leader rises (label above), -1 = leader drops (label below). */
  rise: 1 | -1;
  /** Reticle half size, px. */
  reticle: number;
  /** Diagonal leader leg (both axes), px. */
  diagonal: number;
  /** Horizontal leader leg, px. */
  run: number;
  /**
   * Height of the horizontal leader leg relative to the node centre, px: just
   * below (rising) or above (dropping) the text box, also after a clamp.
   */
  leaderY: number;
  /** Text box relative to the node centre, px. */
  textX: number;
  textY: number;
  /** Use the compact letter-spacing. */
  compact: boolean;
  /** True when no candidate fitted and the box was clamped into the bounds. */
  clamped: boolean;
}

export const LABEL_METRICS = {
  minReticle: 14,
  reticleFactor: 2,
  diagonal: 18,
  minRun: 44,
  /** Gap between the leader and the text. */
  gap: 6,
  /** Gap between the end of the diagonal leg and the text's near edge. */
  textOffset: 4,
  /** Padding around obstacle discs. */
  obstaclePadding: 6,
  /** Padding between two label boxes. */
  boxPadding: 4,
} as const;

/** Margin between the text box and the free-area edge: phones / desktop (V2-03, V2-04). */
export const LABEL_INSET = { touch: 12, desktop: 24 } as const;

/**
 * Label faces (px). D147 raised them by 20 % with the rest of the type scale (index 12 px is the
 * micro-label floor); phones and tablets read at arm's length, so they get a little more on top.
 */
export const LABEL_FONT = { index: 12, name: 15, sub: 13.2 } as const;
export const TOUCH_LABEL_SCALE = 1.08;

/**
 * Rough text block size (CSS px) of a category label — index line over the
 * spaced uppercase name — for when it has not been measured yet (the camera
 * framing uses the measured size as soon as NodeLabels publishes it).
 */
export function estimateLabelSize(name: string, touch: boolean): { width: number; height: number } {
  const scale = touch ? TOUCH_LABEL_SCALE : 1;
  const nameWidth = name.length * LABEL_FONT.name * scale * 0.86;
  const indexWidth = 7 * LABEL_FONT.index * scale * 0.78;
  return {
    width: Math.ceil(Math.max(nameWidth, indexWidth)),
    height: Math.ceil((LABEL_FONT.index + 3 + LABEL_FONT.name * 1.15) * scale),
  };
}

const CANDIDATES: ReadonlyArray<LabelSide> = [
  { side: 1, rise: 1 },
  { side: 1, rise: -1 },
  { side: -1, rise: 1 },
  { side: -1, rise: -1 },
];

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Reticle half size for a core of on-screen radius `coreRadiusPx`. */
export function labelReticle(coreRadiusPx: number): number {
  return Math.max(LABEL_METRICS.minReticle, coreRadiusPx * LABEL_METRICS.reticleFactor);
}

/**
 * What a label placed at `placement` occupies relative to its node centre
 * (CSS px, y down): the text box, and the whole label (text plus the leader's
 * diagonal end). The camera framing reserves room for it (configurator).
 */
export function labelExtents(
  coreRadiusPx: number,
  width: number,
  height: number,
  placement: LabelSide,
): { text: LabelBounds; whole: LabelBounds } {
  const m = LABEL_METRICS;
  const reticle = labelReticle(coreRadiusPx);
  const reach = reticle + m.diagonal;
  const near = reach + m.textOffset;
  const left = placement.side > 0 ? near : -near - width;
  const top = placement.rise > 0 ? -reach - m.gap - height : reach + m.gap;
  const text = { left, top, right: left + width, bottom: top + height };
  const whole = {
    left: placement.side > 0 ? reach : text.left,
    right: placement.side > 0 ? text.right : -reach,
    top: placement.rise > 0 ? text.top : reach,
    bottom: placement.rise > 0 ? -reach : text.bottom,
  };
  return { text, whole };
}

export function layoutLabel(input: LabelInput): LabelLayout {
  const reticle = labelReticle(input.coreRadiusPx);
  let best: { layout: LabelLayout; score: number } | null = null;
  const prefer = input.prefer ?? null;

  for (const compact of [false, true]) {
    const width = compact ? input.compactWidth : input.textWidth;
    for (let c = prefer ? -1 : 0; c < CANDIDATES.length; c++) {
      const candidate = c < 0 ? prefer! : CANDIDATES[c]!;
      if (c >= 0 && prefer && samePlacement(candidate, prefer)) continue;
      const layout = place(input, reticle, width, candidate.side, candidate.rise, compact);
      const box = textBox(input, layout, width);
      const score =
        overflow(box, input.bounds) * 4 +
        collisions(box, input.obstacles) +
        boxCollisions(box, input.boxes);
      if (score === 0) return layout;
      if (!best || score < best.score) best = { layout, score };
    }
  }
  // Nothing fits cleanly: clamp the least-bad candidate (compact spacing) into the bounds.
  const fallback = best!.layout;
  const width = input.compactWidth;
  const box = textBox(input, fallback, width);
  const dx = clampShift(box.left, box.right, input.bounds.left, input.bounds.right);
  const dy = clampShift(box.top, box.bottom, input.bounds.top, input.bounds.bottom);
  const textY = fallback.textY + dy;
  // The text moved: keep the leader's run off it (S4: it crossed "coming soon").
  const leaderY =
    fallback.rise > 0 ? textY + input.textHeight + LABEL_METRICS.gap : textY - LABEL_METRICS.gap;
  return {
    ...fallback,
    compact: true,
    clamped: true,
    textX: fallback.textX + dx,
    textY,
    leaderY,
  };
}

function samePlacement(a: LabelSide, b: LabelSide): boolean {
  return a.side === b.side && a.rise === b.rise;
}

function place(
  input: LabelInput,
  reticle: number,
  width: number,
  side: 1 | -1,
  rise: 1 | -1,
  compact: boolean,
): LabelLayout {
  const m = LABEL_METRICS;
  const run = Math.max(m.minRun, width + m.gap);
  const x1 = side * (reticle + m.diagonal);
  const y1 = -rise * (reticle + m.diagonal);
  const textX = side > 0 ? x1 + m.textOffset : x1 - m.textOffset - width;
  const textY = rise > 0 ? y1 - m.gap - input.textHeight : y1 + m.gap;
  return {
    side,
    rise,
    reticle,
    diagonal: m.diagonal,
    run,
    leaderY: y1,
    textX,
    textY,
    compact,
    clamped: false,
  };
}

/** Text box in screen px. */
function textBox(input: LabelInput, layout: LabelLayout, width: number): Box {
  const left = input.x + layout.textX;
  const top = input.y + layout.textY;
  return { left, top, right: left + width, bottom: top + input.textHeight };
}

/** Pixels of the box outside the bounds (sum over the four edges). */
function overflow(box: Box, bounds: LabelBounds): number {
  return (
    Math.max(0, bounds.left - box.left) +
    Math.max(0, box.right - bounds.right) +
    Math.max(0, bounds.top - box.top) +
    Math.max(0, box.bottom - bounds.bottom)
  );
}

/** Penetration depth of obstacle discs into the box (0 = clear). */
function collisions(box: Box, obstacles: readonly LabelObstacle[]): number {
  let total = 0;
  for (const { x, y, r } of obstacles) {
    const radius = r + LABEL_METRICS.obstaclePadding;
    const nx = Math.min(Math.max(x, box.left), box.right);
    const ny = Math.min(Math.max(y, box.top), box.bottom);
    const distance = Math.hypot(x - nx, y - ny);
    if (distance < radius) total += radius - distance;
  }
  return total;
}

/** Overlap depth of the box with other (padded) boxes (0 = clear). */
function boxCollisions(box: Box, boxes: readonly LabelBounds[] | undefined): number {
  if (!boxes) return 0;
  let total = 0;
  const pad = LABEL_METRICS.boxPadding;
  for (const other of boxes) {
    const x = Math.min(box.right, other.right + pad) - Math.max(box.left, other.left - pad);
    const y = Math.min(box.bottom, other.bottom + pad) - Math.max(box.top, other.top - pad);
    if (x > 0 && y > 0) total += Math.min(x, y);
  }
  return total;
}

/** Shift that moves [start, end] inside [min, max] (or aligns its start when too long). */
function clampShift(start: number, end: number, min: number, max: number): number {
  if (end - start > max - min) return min - start;
  if (start < min) return min - start;
  if (end > max) return max - end;
  return 0;
}

/** Inset free area for the text box. */
export function insetBounds(bounds: LabelBounds, inset: number): LabelBounds {
  return {
    left: bounds.left + inset,
    top: bounds.top + inset,
    right: bounds.right - inset,
    bottom: bounds.bottom - inset,
  };
}

/** Two-digit ordinal index, e.g. "02 / 05". */
export function formatOrdinal(ordinal: number, total: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(ordinal)} / ${pad(total)}`;
}
