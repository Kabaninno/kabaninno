import type { Vec3 } from '../types';

/**
 * The portfolio "archive": project card-objects floating in front of the
 * silver cluster, arranged on a gently curved gallery wall that faces a
 * fixed direction (roughly toward the universe, so the camera flies deeper
 * into space to reach it). Pure and deterministic; data-driven by the number
 * of projects only, so adding a case reflows the wall with no scene change.
 * Units: world units; offsets are relative to the portfolio node centre.
 */
export const ARCHIVE = {
  /** Card body (portrait card-object). */
  cardWidth: 1.3,
  cardHeight: 1.75,
  cardDepth: 0.06,
  /** Centre-to-centre spacing on the wall. */
  spacingX: 2.05,
  spacingY: 2.45,
  /** The wall stands this far in front of the cluster centre (toward the viewer). */
  forward: 1.6,
  /** Curvature: outer cards step back by `arc · x²` (a gallery, not a flat grid). */
  arc: 0.09,
  /** Rows ≈ √(count / rowAspect): wider than tall (2×2 for four, 3 + 2 for five). */
  rowAspect: 1.4,
  /** Viewing direction of the wall (azimuth / elevation, radians). */
  azimuth: -0.38,
  elevation: 0.24,
} as const;

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** Unit vector from the archive toward its viewer. */
export const ARCHIVE_FACING: Vec3 = normalize([
  Math.sin(ARCHIVE.azimuth) * Math.cos(ARCHIVE.elevation),
  Math.sin(ARCHIVE.elevation),
  Math.cos(ARCHIVE.azimuth) * Math.cos(ARCHIVE.elevation),
]);

/** Screen-aligned basis of the wall for a viewer looking along -facing (up = +Y). */
export function archiveBasis(facing: Vec3 = ARCHIVE_FACING): {
  right: Vec3;
  up: Vec3;
  facing: Vec3;
} {
  const f: Vec3 = [-facing[0], -facing[1], -facing[2]];
  const right = normalize([-f[2], 0, f[0]]);
  const up: Vec3 = [
    right[1] * f[2] - right[2] * f[1],
    right[2] * f[0] - right[0] * f[2],
    right[0] * f[1] - right[1] * f[0],
  ];
  return { right, up, facing };
}

/** Rows and columns of the wall for `count` cards. */
export function archiveGrid(count: number): { rows: number; cols: number } {
  if (count <= 0) return { rows: 0, cols: 0 };
  const rows = Math.max(1, Math.round(Math.sqrt(count / ARCHIVE.rowAspect)));
  return { rows, cols: Math.ceil(count / rows) };
}

/**
 * Card slots in wall coordinates [x (right), y (up), z (toward the viewer)],
 * row by row from the top, the last row centred.
 */
export function archiveSlots(count: number): Vec3[] {
  const { rows, cols } = archiveGrid(count);
  const slots: Vec3[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(cols, count - row * cols);
    const y = ((rows - 1) / 2 - row) * ARCHIVE.spacingY;
    for (let col = 0; col < inRow; col++) {
      const x = (col - (inRow - 1) / 2) * ARCHIVE.spacingX;
      slots.push([x, y, -ARCHIVE.arc * x * x]);
    }
  }
  return slots;
}

/** World offset (from the portfolio centre) of every card, in project order. */
export function archiveOffsets(count: number, facing: Vec3 = ARCHIVE_FACING): Vec3[] {
  const { right, up } = archiveBasis(facing);
  return archiveSlots(count).map(([x, y, z]) => {
    const depth = ARCHIVE.forward + z;
    return [
      right[0] * x + up[0] * y + facing[0] * depth,
      right[1] * x + up[1] * y + facing[1] * depth,
      right[2] * x + up[2] * y + facing[2] * depth,
    ];
  });
}

/** Centre of the wall (look target of the portfolio view), offset from the portfolio centre. */
export function archiveCenterOffset(facing: Vec3 = ARCHIVE_FACING): Vec3 {
  return [facing[0] * ARCHIVE.forward, facing[1] * ARCHIVE.forward, facing[2] * ARCHIVE.forward];
}

/** Half extents of the whole wall in its plane, cards included. */
export function archiveExtents(count: number): { halfWidth: number; halfHeight: number } {
  const slots = archiveSlots(count);
  if (slots.length === 0) return { halfWidth: 0, halfHeight: 0 };
  const halfWidth = Math.max(...slots.map(([x]) => Math.abs(x))) + ARCHIVE.cardWidth / 2;
  const halfHeight = Math.max(...slots.map(([, y]) => Math.abs(y))) + ARCHIVE.cardHeight / 2;
  return { halfWidth, halfHeight };
}

/** Radius of a card's bounding sphere. */
export const CARD_RADIUS = Math.hypot(ARCHIVE.cardWidth, ARCHIVE.cardHeight) / 2;
