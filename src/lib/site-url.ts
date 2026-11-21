import { siteConfig } from '~/site.config';
import { BASE_PATH } from './base-path';

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** Shown when a production build has no public URL (see `resolveSiteUrl`). */
export const SITE_URL_MISSING =
  'No public site URL for this production build: set NEXT_PUBLIC_SITE_URL ' +
  '(the GitHub Pages workflow sets it from actions/configure-pages base_url) ' +
  'or a real domain in site.config.ts. For a local preview use `npm run build:preview`.';

/**
 * Public URL of the site root, including the base path and without a trailing
 * slash, e.g. `https://user.github.io/repo` or `https://example.com`. Every
 * absolute URL (canonical, hreflang, Open Graph, sitemap, robots, JSON-LD) is
 * built from it, so it must never be a placeholder or localhost in a
 * deployed build.
 *
 * Priority:
 * 1. `NEXT_PUBLIC_SITE_URL` (http/https). The Pages workflow sets it from
 *    `actions/configure-pages` (`base_url`): `https://<owner>.github.io/<repo>`,
 *    or `https://<custom-domain>` once a domain is configured in Pages
 *    settings; `npm run build:preview` sets it too;
 * 2. the domain in site.config.ts, when it is a real hostname;
 * 3. development only (`next dev`, tests): `http://localhost:3000`;
 * 4. otherwise the production build fails with `SITE_URL_MISSING`.
 */
export function resolveSiteUrl(
  envUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
  domain: string = siteConfig.domain,
  basePath: string = BASE_PATH,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  if (envUrl) {
    try {
      const url = new URL(envUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
      }
    } catch {
      // Fall through to the next source.
    }
  }
  if (HOSTNAME_RE.test(domain)) return `https://${domain}${basePath}`;
  if (nodeEnv !== 'production') return `http://localhost:3000${basePath}`;
  throw new Error(SITE_URL_MISSING);
}

export const SITE_URL = resolveSiteUrl();

/** Absolute URL for a root-relative site path (path must start with "/"). */
export function absoluteUrl(path: string, siteUrl: string = SITE_URL): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
