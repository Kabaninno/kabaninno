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
 * A free column between two overlays that reaches the bottom of the viewport
 * (desktop home: between the hero and the system index) is preferred over the
 * best band when its box scores at least this share of the band's: a centred
 * network between the two reads better than a slightly larger one pushed
 * into a corner (visual V2-02; the 1600×900 composition).
 */
export const COLUMN_PREFERENCE = 0.85;

/**
 * Such a column is trimmed from the bottom to at most `width / COLUMN_MIN_ASPECT`
 * tall. The preferred-aspect box inside it is width-limited anyway, so the
 * trim costs no size; it keeps the composition above the hero baseline and
 * the rect clearly landscape-framed (the camera switches to its portrait
 * overview only for much narrower rects).
 */
export const COLUMN_MIN_ASPECT = 0.75;

interface Candidate {
  rect: Rect;
  score: number;
  area: number;
}

/** Higher score wins; within half a pixel of score, the larger area wins. */
function better(candidate: Candidate, best: Candidate | null): boolean {
  if (best === null) return true;
  return (
    candidate.score > best.score + 0.5 ||
    (Math.abs(candidate.score - best.score) <= 0.5 && candidate.area > best.area)
  );
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
 * Column rule: a candidate between two overlays (free on neither side up to
 * the viewport edge) that reaches the viewport bottom wins when it scores at
 * least `COLUMN_PREFERENCE` × the best; it is then trimmed to
 * `COLUMN_MIN_ASPECT` (see both constants).
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

  let best: Candidate | null = null;
  let bestColumn: Candidate | null = null;
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
          const candidate: Candidate = {
            rect: { x: left, y: top, width, height },
            score: Math.min(width / safeAspect, height),
            area: width * height,
          };
          if (better(candidate, best)) best = candidate;
          const column = left > 0 && right < viewport.width && bottom === viewport.height;
          if (column && better(candidate, bestColumn)) bestColumn = candidate;
        }
      }
    }
  }
  if (best === null) return null;
  if (bestColumn !== null && bestColumn.score >= COLUMN_PREFERENCE * best.score) {
    const { x, y, width, height } = bestColumn.rect;
    return { x, y, width, height: Math.min(height, Math.floor(width / COLUMN_MIN_ASPECT)) };
  }
  return best.rect;
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
