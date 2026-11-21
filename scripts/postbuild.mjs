#!/usr/bin/env node
/**
 * Runs after `next build` (static export to out/):
 * - writes out/.nojekyll (GitHub Pages must not run Jekyll, which drops `_next/`);
 * - writes out/CNAME when PAGES_CNAME is set (optional: with GitHub Actions
 *   deployments the custom domain is configured in Settings → Pages);
 * - normalizes per-segment prefetch files written by Next.js on Windows (see
 *   flattenSegmentPrefetchFiles below);
 * - removes the not-found duplicates Next.js exports next to 404.html
 *   (`404/`, `_not-found/`): static hosts would serve them with HTTP 200 at
 *   `/404/` and `/_not-found/` (soft-404 pages). Nothing requests them: the
 *   client router addresses the not-found segment by key, not by URL;
 * - verifies that the files GitHub Pages needs exist, failing loudly otherwise;
 * - prints a short summary.
 *
 * Dependency-free and cross-platform (Node ≥ 20.9).
 */
import { existsSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = join(root, 'out');

function fail(message) {
  console.error(`\n[postbuild] ERROR: ${message}\n`);
  process.exit(1);
}

if (!existsSync(outDir) || !statSync(outDir).isDirectory()) {
  fail('out/ does not exist. Did `next build` run with `output: "export"`?');
}

writeFileSync(join(outDir, '.nojekyll'), '');

/**
 * Next.js 16.4 static export bug on Windows: per-segment prefetch files are
 * named from a `path.relative()` result (backslashes on Windows), but only "/"
 * is converted to ".", so they land in nested folders, e.g.
 *   pl/services/web/__next.$d$locale/services/$d$category/__PAGE__.txt
 * while the client router requests the flat name
 *   pl/services/web/__next.$d$locale.services.$d$category.__PAGE__.txt
 * (`convertSegmentPathToStaticExportFilename`). Builds on Linux/macOS (CI)
 * are already flat, so this is a no-op there.
 */
function flattenSegmentPrefetchFiles(dir) {
  let moved = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (!entry.name.startsWith('__next.')) {
      moved += flattenSegmentPrefetchFiles(full);
      continue;
    }
    for (const file of walk(full)) {
      const flatName = relative(dir, file).split(sep).join('.');
      const dest = join(dir, flatName);
      renameSync(file, dest);
      moved += 1;
    }
    rmSync(full, { recursive: true, force: true });
  }
  return moved;
}
const flattened = flattenSegmentPrefetchFiles(outDir);

const notFoundDuplicates = ['404', '_not-found', '_global-error'].filter((name) => {
  const dir = join(outDir, name);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  rmSync(dir, { recursive: true, force: true });
  return true;
});

const cname = (process.env.PAGES_CNAME ?? '').trim();
if (cname) {
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(cname)) {
    fail(`PAGES_CNAME="${cname}" is not a valid hostname (use "example.com", no protocol).`);
  }
  writeFileSync(join(outDir, 'CNAME'), `${cname}\n`);
}

const required = [
  'index.html',
  '404.html',
  'pl/index.html',
  'en/index.html',
  'uk/index.html',
  'sitemap.xml',
  'robots.txt',
];
const missing = required.filter((file) => !existsSync(join(outDir, file)));
if (missing.length > 0) {
  fail(`out/ is missing required files:\n  - ${missing.join('\n  - ')}`);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(outDir);
const toPosix = (file) => relative(outDir, file).split(sep).join('/');
const htmlPages = files.filter((file) => file.endsWith('.html')).map(toPosix);
const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

console.log('\n[postbuild] out/ is ready for GitHub Pages');
console.log(`  base path   : ${basePath || '(none)'}`);
console.log(`  site url    : ${process.env.NEXT_PUBLIC_SITE_URL || '(default)'}`);
console.log(`  html pages  : ${htmlPages.length}`);
console.log(`  files       : ${files.length} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  .nojekyll   : yes`);
console.log(
  `  segment fix : ${flattened ? `${flattened} prefetch files flattened (Next.js Windows export bug)` : 'not needed'}`,
);
console.log(
  `  removed     : ${notFoundDuplicates.length ? notFoundDuplicates.map((name) => `${name}/`).join(', ') : '(nothing)'}`,
);
console.log(`  CNAME       : ${cname || '(not written; PAGES_CNAME is empty)'}`);
console.log(`  checked     : ${required.join(', ')}\n`);
