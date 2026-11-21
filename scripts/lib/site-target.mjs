/**
 * Public URL and base path of a local preview build (`npm run build:preview`),
 * chosen the way GitHub Pages will serve the site, so a preview never bakes
 * localhost into canonical URLs, Open Graph tags, the sitemap or JSON-LD.
 * Pure functions (unit-tested in tests/unit/site-target.test.ts); the script
 * passes the environment and the git remote in.
 */

/** RFC 2606 reserved TLD: never resolves, so a leaked URL can never point anywhere. */
export const INVALID_SITE_ORIGIN = 'https://kabaninno.invalid';

/** Base path when nothing else is known (the repository name used so far). */
export const DEFAULT_BASE_PATH = '/kabaninno';

/**
 * `owner/repo` from `GITHUB_REPOSITORY` or a github.com remote URL:
 * `https://github.com/owner/repo(.git)`, `git@github.com:owner/repo(.git)`,
 * `ssh://git@github.com/owner/repo(.git)`. Null for anything else.
 */
export function parseGithubRepository(value) {
  const input = (value ?? '').trim();
  if (!input) return null;
  const patterns = [
    /^([\w.-]+)\/([\w.-]+)$/,
    /^https?:\/\/(?:[^@/]+@)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i,
    /^ssh:\/\/git@github\.com(?::\d+)?\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(input);
    if (match) return { owner: match[1], repo: match[2] };
  }
  return null;
}

/**
 * What actions/configure-pages reports for a repository without a custom
 * domain: a project site at `https://<owner>.github.io/<repo>` (base path
 * `/<repo>`), or a user/organisation site for the `<owner>.github.io`
 * repository (empty base path). The owner is lowercased, like GitHub does.
 */
export function pagesTargetFor({ owner, repo }) {
  const user = owner.toLowerCase();
  const origin = `https://${user}.github.io`;
  if (repo.toLowerCase() === `${user}.github.io`) return { origin, basePath: '' };
  return { origin, basePath: `/${repo}` };
}

function normalizeBase(raw) {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function cleanUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * Base path and site URL of a preview build.
 * - Base path: NEXT_PUBLIC_BASE_PATH → PREVIEW_BASE_PATH → the repository's
 *   Pages base path → `/kabaninno`.
 * - Site URL: NEXT_PUBLIC_SITE_URL → PREVIEW_SITE_URL (explicit values win)
 *   → the repository's Pages origin + base path → `https://kabaninno.invalid`
 *   + base path, with a warning. Never localhost.
 * The repository comes from GITHUB_REPOSITORY (GitHub Actions) or the git
 * remote `origin`.
 */
export function resolvePreviewTarget(env, remoteUrl) {
  const repository =
    parseGithubRepository(env.GITHUB_REPOSITORY) ?? parseGithubRepository(remoteUrl);
  const pages = repository ? pagesTargetFor(repository) : null;

  const explicitBase = env.NEXT_PUBLIC_BASE_PATH ?? env.PREVIEW_BASE_PATH;
  const basePath =
    explicitBase !== undefined
      ? normalizeBase(explicitBase)
      : pages
        ? pages.basePath
        : DEFAULT_BASE_PATH;

  const explicit = cleanUrl(env.NEXT_PUBLIC_SITE_URL ?? '') ?? cleanUrl(env.PREVIEW_SITE_URL ?? '');
  if (explicit) return { basePath, siteUrl: explicit, source: 'env' };
  if (pages) {
    return {
      basePath,
      siteUrl: `${pages.origin}${basePath}`,
      source: `github:${repository.owner}/${repository.repo}`,
    };
  }
  return {
    basePath,
    siteUrl: `${INVALID_SITE_ORIGIN}${basePath}`,
    source: 'fallback',
    warning:
      'No public URL is known yet (no NEXT_PUBLIC_SITE_URL / PREVIEW_SITE_URL, no GitHub remote): ' +
      `absolute URLs use the reserved, non-resolvable ${INVALID_SITE_ORIGIN}. ` +
      'Fine for a local preview; deploys get the real URL from the Pages workflow.',
  };
}
