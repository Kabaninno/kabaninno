/**
 * Base path handling for static hosting (GitHub Pages project sites live under
 * `/<repo>`, custom domains under `/`). The value comes from
 * `NEXT_PUBLIC_BASE_PATH` at build time and is inlined into client bundles.
 */

export function normalizeBasePath(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

export const BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

/**
 * Prefixes a root-relative asset path with the base path. Use this for any URL
 * that does not go through `next/link` or the Next.js router (textures, fetch(),
 * raw <a>/<img> tags, meta refresh targets, 3D scene assets).
 */
export function withBasePath(path: string, basePath: string = BASE_PATH): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalized}`;
}
