'use client';

import { usePathname } from '@/i18n/navigation';
import { sectionForPath, type SiteSection } from '@/lib/nav';
import { withTrailingSlash } from '@/lib/style';

/** Locale-less pathname (always with a trailing slash) and its site section. */
export function useHudLocation(): { pathname: string; section: SiteSection } {
  const pathname = withTrailingSlash(usePathname());
  return { pathname, section: sectionForPath(pathname) };
}
