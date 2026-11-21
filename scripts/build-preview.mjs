#!/usr/bin/env node
/**
 * Production build under a non-empty base path, the way GitHub Pages project
 * sites are served (`https://<user>.github.io/<repo>/`). Use it with
 * `npm run serve` to catch asset/link paths that ignore the base path.
 *
 *   npm run build:preview                      # production content
 *   npm run build:preview -- --drafts          # + draft portfolio cases (SHOW_DRAFTS=true)
 *   PREVIEW_BASE_PATH=/repo npm run build:preview
 *
 * Production content is the default: an inherited SHOW_DRAFTS variable (easy
 * to leave behind in a PowerShell session) is ignored with a warning; draft
 * cases need the explicit `--drafts` flag.
 *
 * Public URL and base path (scripts/lib/site-target.mjs): what the Pages
 * workflow would use for this repository (`https://<owner>.github.io/<repo>`,
 * from GITHUB_REPOSITORY or the git remote `origin`), unless
 * NEXT_PUBLIC_SITE_URL / PREVIEW_SITE_URL and NEXT_PUBLIC_BASE_PATH /
 * PREVIEW_BASE_PATH say otherwise. Without any of them the base path is
 * `/kabaninno` and absolute URLs use the reserved, non-resolvable
 * `https://kabaninno.invalid` (with a warning). Never localhost: the
 * postbuild guard rejects it. The local server (`npm run serve`) still
 * serves the pages; only canonical/Open Graph/sitemap URLs point elsewhere.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolvePreviewTarget } from './lib/site-target.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

/** The `origin` remote, or null (no git, no remote). */
function gitRemote() {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

const target = resolvePreviewTarget(process.env, gitRemote());
const { basePath, siteUrl } = target;
if (target.warning) console.warn(`[build-preview] WARNING: ${target.warning}`);

const env = {
  ...process.env,
  NEXT_PUBLIC_BASE_PATH: basePath,
  NEXT_PUBLIC_SITE_URL: siteUrl,
  // Tells postbuild that the reserved `.invalid` preview origin is expected here.
  PREVIEW_BUILD: '1',
};
const drafts = process.argv.slice(2).includes('--drafts');
delete env.SHOW_DRAFTS;
if (drafts) env.SHOW_DRAFTS = 'true';
else if (process.env.SHOW_DRAFTS) {
  console.warn(
    '[build-preview] SHOW_DRAFTS is set in the environment but ignored: pass --drafts to include draft cases.',
  );
}

console.log(`[build-preview] NEXT_PUBLIC_BASE_PATH=${basePath}`);
console.log(`[build-preview] NEXT_PUBLIC_SITE_URL=${siteUrl} (${target.source})`);
console.log(
  `[build-preview] content: ${drafts ? 'with drafts (SHOW_DRAFTS=true)' : 'production'}\n`,
);

function run(label, args) {
  // process.execPath + script path: no shell, works the same on Windows/macOS/Linux.
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n[build-preview] ${label} failed (exit ${result.status ?? result.signal}).`);
    process.exit(result.status ?? 1);
  }
}

run('next build', [require.resolve('next/dist/bin/next'), 'build']);
run('postbuild', [fileURLToPath(new URL('./postbuild.mjs', import.meta.url))]);

const port = process.env.PREVIEW_PORT ?? '4173';
console.log(
  `[build-preview] Done. Serve it with: npm run serve  →  http://localhost:${port}${basePath}/`,
);
