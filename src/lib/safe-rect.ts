import type { SafeRect } from '@/store/scene';

/** Axis-aligned rectangle in CSS pixels (viewport coordinates). */
export type Rect = SafeRect;

export interface ViewportSize {
  width: number;
  height: number;
}

/** Attribute that marks an HTML overlay the camera must keep the scene out of. */
export const SCENE_OVERLAY_ATTRIBUTE = 'data-scene-overlay';

/**
 * Preferred aspect (width / height) of the area the camera frames: the
 * universe and the planetary systems are wider than tall on landscape screens.
 * On portrait screens a squarer box fits the portrait framing (D26).
 */
export function preferredFrameAspect(viewport: ViewportSize): number {
  return viewport.width >= viewport.height ? 1.5 : 1;
}

/**
 * Clips an obstacle to the viewport and snaps its edges to whole pixels, the
 * same grid the candidate edges use (a 0.4 px sliver must not block a rect
 * that shares the obstacle's rounded edge).
 */
function clipToViewport(rect: Rect, viewport: ViewportSize): Rect | null {
  const left = Math.round(Math.max(0, rect.x));
  const top = Math.round(Math.max(0, rect.y));
  const right = Math.round(Math.min(viewport.width, rect.x + rect.width));
  const bottom = Math.round(Math.min(viewport.height, rect.y + rect.height));
  if (right - left < 1 || bottom - top < 1) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function sortedEdges(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Largest useful free rectangle of the viewport that no obstacle (HTML
 * overlay) intersects.
 *
 * Every maximal empty rectangle has its sides on viewport or obstacle edges,
 * so candidates are all pairs of those edges (overlays are few, so the
 * brute force stays tiny: ~2k candidates for 4 overlays, run only on
 * resize/route changes). A candidate is scored by the size of the largest box
 * with the preferred aspect that fits inside it — `min(width / aspect,
 * height)` — so a very wide but short strip does not beat a well-proportioned
 * area. Ties go to the larger area.
 *
 * Returns the full viewport when nothing overlaps it, and `null` for an empty
 * viewport or when overlays cover everything.
 */
export function largestFreeRect(
  rawViewport: ViewportSize,
  obstacles: readonly Rect[],
  aspect: number = preferredFrameAspect(rawViewport),
): Rect | null {
  if (rawViewport.width < 1 || rawViewport.height < 1) return null;
  const viewport = { width: Math.round(rawViewport.width), height: Math.round(rawViewport.height) };
  const blocks = obstacles
    .map((rect) => clipToViewport(rect, viewport))
    .filter((rect): rect is Rect => rect !== null);
  if (blocks.length === 0) return { x: 0, y: 0, width: viewport.width, height: viewport.height };

  const xs = sortedEdges([0, viewport.width, ...blocks.flatMap((b) => [b.x, b.x + b.width])]);
  const ys = sortedEdges([0, viewport.height, ...blocks.flatMap((b) => [b.y, b.y + b.height])]);
  const safeAspect = aspect > 0 ? aspect : 1;

  let best: Rect | null = null;
  let bestScore = 0;
  let bestArea = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      const left = xs[i]!;
      const right = xs[j]!;
      for (let k = 0; k < ys.length - 1; k += 1) {
        for (let l = k + 1; l < ys.length; l += 1) {
          const top = ys[k]!;
          const bottom = ys[l]!;
          const blocked = blocks.some(
            (b) => b.x < right && b.x + b.width > left && b.y < bottom && b.y + b.height > top,
          );
          // Taller candidates with the same top/left/right are blocked too.
          if (blocked) break;
          const width = right - left;
          const height = bottom - top;
          const score = Math.min(width / safeAspect, height);
          const area = width * height;
          if (score > bestScore + 0.5 || (Math.abs(score - bestScore) <= 0.5 && area > bestArea)) {
            best = { x: left, y: top, width, height };
            bestScore = score;
            bestArea = area;
          }
        }
      }
    }
  }
  return best;
}

/** True when both rects are null or every side differs by less than `tolerance` px. */
export function sameRect(a: Rect | null, b: Rect | null, tolerance = 1): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.x - b.x) < tolerance &&
    Math.abs(a.y - b.y) < tolerance &&
    Math.abs(a.width - b.width) < tolerance &&
    Math.abs(a.height - b.height) < tolerance
  );
}
