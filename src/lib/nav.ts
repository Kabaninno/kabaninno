import { withTrailingSlash } from './style';

/**
 * Client-safe navigation helpers. Server-side builders that read content texts
 * live in `nav-data.ts` (keeps dictionaries out of client bundles).
 */

/** Category entry for HUD navigation, prepared on the server from `content/`. */
export interface NavCategory {
  id: string;
  name: string;
  /** DNA accent color (#RRGGBB). */
  color: string;
  /** Very short card caption (`categories.<id>.caption`). */
  caption: string;
  /** 1-based position in the category order. */
  index: number;
}

export type SiteSection = 'home' | 'services' | 'portfolio' | 'configurator' | 'other';

/** Section of the site for a locale-less pathname. */
export function sectionForPath(pathname: string): SiteSection {
  const path = withTrailingSlash(pathname);
  if (path === '/') return 'home';
  if (path.startsWith('/services/')) return 'services';
  if (path.startsWith('/portfolio/')) return 'portfolio';
  if (path.startsWith('/configurator/')) return 'configurator';
  return 'other';
}

/**
 * `aria-current` for a nav link: "page" on the exact page, "true" anywhere
 * inside its section (e.g. Portfolio while a case is open).
 */
export function ariaCurrentFor(pathname: string, href: string): 'page' | 'true' | undefined {
  const path = withTrailingSlash(pathname);
  const target = withTrailingSlash(href);
  if (path === target) return 'page';
  if (target !== '/' && path.startsWith(target)) return 'true';
  return undefined;
}
