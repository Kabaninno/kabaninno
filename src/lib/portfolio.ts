import { sceneNodeId } from '@/scene/node-ids';

/**
 * Pure helpers for the portfolio (BRIEF «Портфоліо»): the category filter,
 * case siblings, and the D87 scene emphasis. Client-safe (no content import):
 * the server prepares plain card data, the browser filters it.
 */

/** Query parameter of the category filter (`/portfolio/?category=web`). */
export const CATEGORY_PARAM = 'category';

export interface FilterableProject {
  slug: string;
  categories: readonly string[];
}

export interface FilterOption {
  id: string;
  count: number;
}

/** Categories that have at least one visible project, in content order, with counts. */
export function filterOptions(
  projects: readonly FilterableProject[],
  categoryOrder: readonly string[],
): FilterOption[] {
  return categoryOrder
    .map((id) => ({
      id,
      count: projects.filter((project) => project.categories.includes(id)).length,
    }))
    .filter((option) => option.count > 0);
}

/** The active filter from the query value: a known category id, otherwise none. */
export function parseCategoryFilter(
  value: string | null | undefined,
  validIds: readonly string[],
): string | null {
  return value && validIds.includes(value) ? value : null;
}

export function filterProjects<T extends FilterableProject>(
  projects: readonly T[],
  category: string | null,
): T[] {
  return category === null
    ? [...projects]
    : projects.filter((project) => project.categories.includes(category));
}

/** Scene emphasis on the portfolio route (D87): the filtered projects; none without a filter. */
export function emphasisForFilter(
  projects: readonly FilterableProject[],
  category: string | null,
): string[] {
  if (category === null) return [];
  return filterProjects(projects, category).map((project) => sceneNodeId.project(project.slug));
}

/** Previous / next case around `slug`, wrapping; null when there is no other case. */
export function projectSiblings(
  slugs: readonly string[],
  slug: string,
): { previous: string; next: string } | null {
  const index = slugs.indexOf(slug);
  if (index < 0 || slugs.length < 2) return null;
  return {
    previous: slugs[(index - 1 + slugs.length) % slugs.length]!,
    next: slugs[(index + 1) % slugs.length]!,
  };
}

/** Sandbox of embedded live demos: scripts and forms run, top navigation and popups do not. */
export const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms';

/** Attributes of the live-demo iframe (after the visitor asked to load it). */
export function iframeDemoAttributes(demo: { url: string; aspectRatio: number }, title: string) {
  return {
    src: demo.url,
    title,
    loading: 'lazy' as const,
    sandbox: IFRAME_SANDBOX,
    referrerPolicy: 'no-referrer' as const,
    allow: 'fullscreen',
    style: { aspectRatio: String(demo.aspectRatio) },
  };
}

/** The host name shown on the demo facade ("example.com"). */
export function demoHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Fills `{name}` tokens of a pre-translated template (a raw dictionary
 * string), so the browser needs no ICU formatter for simple interpolation.
 */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
