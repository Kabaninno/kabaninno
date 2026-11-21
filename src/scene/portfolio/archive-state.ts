import type { ArchiveProjectModel } from '../universe/model';

/** Brightness of a focused project's siblings. */
export const PROJECT_SIBLING_DIM = 0.3;
/** Brightness of cards outside the active category filter (D87). */
export const FILTER_DIM = 0.22;

export interface CardTarget {
  /** 1 for the highlighted card. */
  hover: number;
  /** Target brightness (hover relights a dimmed card on top of this). */
  dim: number;
  /** 1 for cards inside an active filter. */
  select: number;
}

/**
 * Where each card's hover, brightness and filter emphasis are heading:
 * - the highlighted card (`project:<slug>`, 3D hover or HTML card) hovers;
 * - on a project route its siblings recede, the focused card does not;
 * - a non-empty filter (`project:<slug>` ids, D87) lifts its cards and dims
 *   the rest (never the focused card). `filter` null = not on the portfolio.
 */
export function archiveCardTargets(
  projects: readonly Pick<ArchiveProjectModel, 'slug' | 'key'>[],
  highlight: string | null,
  focusedProject: string | null,
  filter: ReadonlySet<string> | null,
): CardTarget[] {
  const filtering = !!filter && filter.size > 0;
  return projects.map((project) => {
    const focused = project.slug === focusedProject;
    const inFilter = filtering && filter.has(project.key);
    let dim = 1;
    if (focusedProject !== null && !focused) dim = PROJECT_SIBLING_DIM;
    if (filtering && !inFilter && !focused) dim = Math.min(dim, FILTER_DIM);
    return { hover: highlight === project.key ? 1 : 0, dim, select: inFilter ? 1 : 0 };
  });
}
