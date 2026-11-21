import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';

// Static export: rendered once at build time into out/robots.txt.
export const dynamic = 'force-static';

/*
 * Note: crawlers only read robots.txt at the host root, so it takes effect on a
 * custom domain (empty base path); on `<user>.github.io/<repo>` it is inert.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
