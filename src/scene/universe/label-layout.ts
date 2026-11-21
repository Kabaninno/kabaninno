/**
 * Placement of the hover label (pure, three-free). The label hangs off a
 * leader line that leaves the node's reticle diagonally and then runs
 * horizontally under (or over) the text (art direction: leader lines,
 * reticle). Candidates, in order: right-up, right-down, left-up, left-down;
 * the first whose text box stays inside the free area and clear of the other
 * nodes' cores wins. If none fits at the normal letter-spacing, the compact
 * spacing is tried; as a last resort the best candidate is clamped inside
 * the free area (visual V2-03, V2-04).
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
  /** Padding around obstacle discs. */
  obstaclePadding: 6,
} as const;

/** Margin between the text box and the free-area edge: phones / desktop (V2-03, V2-04). */
export const LABEL_INSET = { touch: 12, desktop: 24 } as const;

const CANDIDATES: ReadonlyArray<{ side: 1 | -1; rise: 1 | -1 }> = [
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

export function layoutLabel(input: LabelInput): LabelLayout {
  const m = LABEL_METRICS;
  const reticle = Math.max(m.minReticle, input.coreRadiusPx * m.reticleFactor);
  let best: { layout: LabelLayout; score: number } | null = null;

  for (const compact of [false, true]) {
    const width = compact ? input.compactWidth : input.textWidth;
    for (const { side, rise } of CANDIDATES) {
      const layout = place(input, reticle, width, side, rise, compact);
      const box = textBox(input, layout, width);
      const score = overflow(box, input.bounds) * 4 + collisions(box, input.obstacles);
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
  return {
    ...fallback,
    compact: true,
    clamped: true,
    textX: fallback.textX + dx,
    textY: fallback.textY + dy,
  };
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
  const textX = side > 0 ? x1 + 4 : x1 - 4 - width;
  const textY = rise > 0 ? y1 - m.gap - input.textHeight : y1 + m.gap;
  return { side, rise, reticle, diagonal: m.diagonal, run, textX, textY, compact, clamped: false };
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
