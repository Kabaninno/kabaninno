import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';
import { languageAlternates, localizedPath } from '@/lib/metadata';
import { getAllSitePaths } from '@/lib/site-paths';
import { absoluteUrl } from '@/lib/site-url';

// Static export: rendered once at build time into out/sitemap.xml.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return getAllSitePaths().flatMap((path) => {
    const languages = languageAlternates(path);
    return locales.map((locale) => ({
      url: absoluteUrl(localizedPath(locale, path)),
      alternates: { languages },
    }));
  });
}
