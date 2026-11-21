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
 * - rewrites the root redirect page (out/index.html) as a minimal document:
 *   meta refresh + a one-line inline script + canonical + language links, no
 *   app scripts, stylesheets or font preloads (perf P-06; see
 *   writeMinimalRootRedirect);
 * - adds per-locale font preloads for the subsets each locale always needs
 *   (perf P-05; see preloadLocaleFonts);
 * - verifies that the files GitHub Pages needs exist, failing loudly otherwise;
 * - fails when any exported page, metadata file or payload contains a
 *   localhost URL or an unreplaced site.config placeholder (url-guard.mjs);
 *   outside `build:preview` also the reserved `.invalid` preview origin;
 * - prints a short summary.
 *
 * Dependency-free and cross-platform (Node ≥ 20.9).
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findForbiddenUrls } from './lib/url-guard.mjs';

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

/** Escapes text for HTML content and double-quoted attributes. */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * `/` is only a redirect to `/pl/` (src/app/page.tsx), but Next.js renders it
 * like any page: 3 font preloads, 2 stylesheets and 7 scripts (~172 KiB gzip)
 * for a document that leaves at once. The page is rebuilt from the values
 * Next.js rendered into it (target, canonical, title, icon, language links),
 * so src/app/page.tsx stays the single source. It keeps the exact meta refresh
 * markup `http-equiv="refresh" content="0; url=…"` that serve-out.mjs and the
 * e2e setup read to detect the base path.
 */
function writeMinimalRootRedirect() {
  const file = join(outDir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const pick = (pattern, label) => {
    const match = pattern.exec(html);
    if (!match) fail(`root redirect: could not find the ${label} in out/index.html`);
    return match[1];
  };
  const target = pick(/<meta http-equiv="refresh" content="0; url=([^"]+)"/, 'meta refresh');
  const canonical = pick(/<link rel="canonical" href="([^"]+)"/, 'canonical link');
  const title = pick(/<title>([^<]*)<\/title>/, 'title');
  const lang = pick(/<html lang="([^"]+)"/, 'html lang');
  const icon = /<link rel="icon" href="([^"]+)"[^>]*type="([^"]+)"/.exec(html);
  const languages = [
    ...html.matchAll(/<a href="([^"]+)" hreflang="([^"]+)" lang="[^"]+"[^>]*>([^<]+)<\/a>/gi),
  ].map(([, href, hreflang, label]) => ({ href, hreflang, label }));
  if (languages.length === 0) fail('root redirect: no language links found in out/index.html');

  const links = languages
    .map(
      ({ href, hreflang, label }) =>
        `<li><a href="${href}" hreflang="${hreflang}" lang="${hreflang}">${label}</a></li>`,
    )
    .join('');
  const page = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="canonical" href="${canonical}">${
    icon ? `<link rel="icon" href="${icon[1]}" type="${icon[2]}">` : ''
  }<meta name="theme-color" content="#05070D"><meta http-equiv="refresh" content="0; url=${target}"><script>location.replace(${JSON.stringify(
    target.replace(/&amp;/g, '&'),
  )}+location.search+location.hash);</script><style>html{background:#05070d;color:#e8ecf5;color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;padding:1.5rem;text-align:center}a{color:inherit;display:inline-flex;align-items:center;min-height:44px;padding:0 1rem;border-radius:999px;text-underline-offset:6px}a:hover,a:focus-visible{background:rgb(255 255 255/.06)}a:focus-visible{outline:2px solid #e8ecf5;outline-offset:3px}.brand{letter-spacing:.2em;font-size:1.125rem}ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem}</style></head><body><main><p><a class="brand" href="${target}">${escapeHtml(
    title,
  )}</a></p><ul>${links}</ul></main></body></html>\n`;
  writeFileSync(file, page);
  return Buffer.byteLength(page);
}
const rootRedirectBytes = writeMinimalRootRedirect();

/**
 * Per-locale font preloads (perf P-05, recorded in DECISIONS.md). next/font
 * preloads the same subsets on every locale (D21: Unbounded latin, Manrope
 * latin + latin-ext). Polish headlines always need Unbounded latin-ext (Ł, ą,
 * ż…) and Ukrainian text needs the Cyrillic files of Unbounded and Manrope.
 * Discovered late (after CSS and layout), they swapped in after the first
 * paint, re-wrapped the hero headline and shifted the hero frame (CLS 0.026).
 * Those files are downloaded on those locales anyway, so preloading them
 * costs no extra bytes, only an earlier start. The URLs come from the built
 * CSS: the face of the family whose unicode-range starts with the token.
 */
const LOCALE_FONT_PRELOADS = {
  pl: [{ family: 'Unbounded', range: 'U+100-2BA' }],
  uk: [
    { family: 'Unbounded', range: 'U+301,U+400-45F' },
    { family: 'Manrope', range: 'U+301,U+400-45F' },
  ],
};

function preloadLocaleFonts() {
  const cssDir = join(outDir, '_next', 'static', 'chunks');
  const faces = [];
  for (const name of existsSync(cssDir) ? readdirSync(cssDir) : []) {
    if (!name.endsWith('.css')) continue;
    const css = readFileSync(join(cssDir, name), 'utf8');
    for (const [face] of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
      const family = /font-family:\s*["']?([^;"']+)/.exec(face)?.[1]?.trim();
      const url = /url\(([^)]+\.woff2)\)/.exec(face)?.[1];
      const range = /unicode-range:\s*([^;}]+)/.exec(face)?.[1]?.replace(/\s+/g, '') ?? '';
      if (family && url) faces.push({ family, file: url.split('/').pop(), range });
    }
  }
  const summary = [];
  for (const [locale, wanted] of Object.entries(LOCALE_FONT_PRELOADS)) {
    const files = wanted.map(({ family, range }) => {
      const face = faces.find((item) => item.family === family && item.range.startsWith(range));
      if (!face) fail(`font preload: no ${family} face with unicode-range ${range}… in the CSS`);
      return face.file;
    });
    const localeDir = join(outDir, locale);
    if (!existsSync(localeDir)) continue;
    let pages = 0;
    for (const page of walk(localeDir).filter((file) => file.endsWith('.html'))) {
      const html = readFileSync(page, 'utf8');
      const anchor =
        /<link rel="preload" href="([^"]*\/_next\/static\/media\/)[^"]+\.woff2"[^>]*\/>/g;
      const existing = [...html.matchAll(anchor)];
      const last = existing.at(-1);
      if (!last) continue;
      const prefix = last[1];
      const tags = files
        .filter((file) => !html.includes(`${prefix}${file}"`))
        .map(
          (file) =>
            `<link rel="preload" href="${prefix}${file}" as="font" crossorigin="" type="font/woff2"/>`,
        )
        .join('');
      if (!tags) continue;
      const at = last.index + last[0].length;
      writeFileSync(page, html.slice(0, at) + tags + html.slice(at));
      pages += 1;
    }
    summary.push(`${locale}: ${files.join(', ')} (${pages} pages)`);
  }
  return summary;
}
const localeFontPreloads = preloadLocaleFonts();

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

/*
 * No localhost or placeholder may reach a deploy: canonical, hreflang, Open
 * Graph, sitemap, robots and JSON-LD are all absolute URLs. CI runs this
 * same script, so the Pages deploy fails instead of shipping them.
 */
const isPreview = process.env.PREVIEW_BUILD === '1';
const extraRules = isPreview ? [] : [{ label: 'kabaninno.invalid', pattern: /kabaninno\.invalid/ }];
const forbidden = files.flatMap((file) => {
  const path = toPosix(file);
  if (!/\.(html|xml|txt|json|webmanifest|m?js)$/i.test(path)) return [];
  return findForbiddenUrls(path, readFileSync(file, 'utf8'), extraRules);
});
if (forbidden.length > 0) {
  const byFile = new Map();
  for (const hit of forbidden) byFile.set(hit.path, [...(byFile.get(hit.path) ?? []), hit]);
  const lines = [...byFile.entries()]
    .slice(0, 25)
    .map(
      ([path, hits]) =>
        `  - ${path}: ${hits.map((hit) => `${hit.label} (…${hit.excerpt}…)`).join('; ')}`,
    );
  const more = byFile.size > 25 ? '\n  …' : '';
  fail(
    `out/ contains localhost URLs or unreplaced placeholders in ${byFile.size} file(s):\n` +
      `${lines.join('\n')}${more}\n` +
      'Set NEXT_PUBLIC_SITE_URL (the Pages workflow sets it from actions/configure-pages base_url) ' +
      'or a real domain in site.config.ts, and replace the placeholders in site.config.ts.',
  );
}
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
console.log(`  root page   : minimal redirect (${rootRedirectBytes} B)`);
console.log(`  font preload: ${localeFontPreloads.join('; ') || '(none)'}`);
console.log(`  CNAME       : ${cname || '(not written; PAGES_CNAME is empty)'}`);
console.log(`  checked     : ${required.join(', ')}`);
console.log(`  url guard   : no localhost or placeholders${isPreview ? ' (preview build)' : ''}\n`);
