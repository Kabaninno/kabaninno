import { siteConfig } from '~/site.config';
import { BASE_PATH } from './base-path';

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/**
 * Public URL of the site root, including the base path and without a trailing
 * slash, e.g. `https://user.github.io/repo` or `https://example.com`.
 *
 * Priority: `NEXT_PUBLIC_SITE_URL` (set by the Pages workflow) → the domain in
 * site.config.ts (if it is a real hostname) → localhost for local builds.
 */
export function resolveSiteUrl(
  envUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
  domain: string = siteConfig.domain,
  basePath: string = BASE_PATH,
): string {
  if (envUrl) {
    try {
      const url = new URL(envUrl);
      return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
    } catch {
      // Fall through to the next source.
    }
  }
  if (HOSTNAME_RE.test(domain)) return `https://${domain}${basePath}`;
  return `http://localhost:3000${basePath}`;
}

export const SITE_URL = resolveSiteUrl();

/** Absolute URL for a root-relative site path (path must start with "/"). */
export function absoluteUrl(path: string, siteUrl: string = SITE_URL): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
