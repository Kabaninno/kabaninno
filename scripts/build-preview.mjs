#!/usr/bin/env node
/**
 * Production build under a non-empty base path, the way GitHub Pages project
 * sites are served (`https://<user>.github.io/<repo>/`). Use it with
 * `npm run serve` to catch asset/link paths that ignore the base path.
 *
 *   npm run build:preview                      # base path /kabaninno
 *   PREVIEW_BASE_PATH=/repo npm run build:preview
 *
 * Env overrides: PREVIEW_BASE_PATH (default "/kabaninno"), PREVIEW_PORT
 * (default 4173), or pass NEXT_PUBLIC_BASE_PATH / NEXT_PUBLIC_SITE_URL directly.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.PREVIEW_BASE_PATH ?? '/kabaninno';
const port = process.env.PREVIEW_PORT ?? '4173';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${port}${basePath}`;

const env = {
  ...process.env,
  NEXT_PUBLIC_BASE_PATH: basePath,
  NEXT_PUBLIC_SITE_URL: siteUrl,
};

console.log(`[build-preview] NEXT_PUBLIC_BASE_PATH=${basePath}`);
console.log(`[build-preview] NEXT_PUBLIC_SITE_URL=${siteUrl}\n`);

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

console.log(`[build-preview] Done. Serve it with: npm run serve  →  ${siteUrl}/`);
