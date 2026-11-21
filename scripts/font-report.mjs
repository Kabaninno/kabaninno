#!/usr/bin/env node
/**
 * Reports web font usage of a built page in out/: every @font-face (family,
 * subset, file size), which files are preloaded, and the total preloaded bytes.
 * Also checks that Polish (latin-ext) and Ukrainian (cyrillic incl. U+0490–0491)
 * glyph ranges are available for the display and text fonts.
 *
 * Usage: node scripts/font-report.mjs [page=pl/index.html]
 * Works with any base path (asset URLs are resolved against out/).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(fileURLToPath(new URL('../out', import.meta.url)));
const page = process.argv[2] ?? 'pl/index.html';
const pagePath = join(outDir, page);
if (!existsSync(pagePath)) {
  console.error(`[font-report] ${pagePath} not found. Run a build first.`);
  process.exit(1);
}

const html = readFileSync(pagePath, 'utf8');
const basePath = (html.match(/href="([^"]*)\/_next\/static\//) ?? [])[1] ?? '';
const toOutPath = (url) => join(outDir, url.slice(basePath.length).replace(/^\//, ''));

const preloaded = new Set(
  [...html.matchAll(/<link rel="preload" href="([^"]+\.woff2)"/g)].map((m) => basename(m[1])),
);
const stylesheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);

function subsetOf(range) {
  if (/U\+460-52F/i.test(range)) return 'cyrillic-ext';
  if (/U\+400-45F/i.test(range)) return 'cyrillic';
  if (/U\+370-377|U\+370-3FF/i.test(range)) return 'greek';
  if (/U\+102-103/i.test(range)) return 'vietnamese';
  if (/U\+100-2BA|U\+100-2AF/i.test(range)) return 'latin-ext';
  if (/U\+0-FF|U\+0000-00FF|U\+\?\?/i.test(range)) return 'latin';
  return 'other';
}

const faces = [];
for (const href of stylesheets) {
  const cssPath = toOutPath(href);
  const css = readFileSync(cssPath, 'utf8');
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = (body.match(/font-family:\s*([^;]+)/) ?? [])[1]?.replace(/["']/g, '').trim();
    const src = (body.match(/url\(([^)]+)\)/) ?? [])[1]?.replace(/["']/g, '');
    const range = (body.match(/unicode-range:\s*([^;]+)/) ?? [])[1] ?? '';
    if (!family || !src || family.endsWith('Fallback')) continue;
    const file = src.startsWith('/') ? toOutPath(src) : resolve(dirname(cssPath), src);
    faces.push({
      family,
      subset: subsetOf(range),
      kb: statSync(file).size / 1024,
      preload: preloaded.has(basename(src)),
      range,
    });
  }
}

console.log(`\nFonts for out/${page} (base path: ${basePath || '(none)'})\n`);
for (const face of faces) {
  console.log(
    `  ${face.family.padEnd(16)} ${face.subset.padEnd(13)} ${face.kb.toFixed(1).padStart(6)} KB  ${face.preload ? 'PRELOAD' : ''}`,
  );
}
const preloadedFaces = faces.filter((face) => face.preload);
const totalKb = preloadedFaces.reduce((sum, face) => sum + face.kb, 0);
console.log(`\n  preloaded: ${preloadedFaces.length} files, ${totalKb.toFixed(1)} KB`);

let ok = true;
for (const family of ['Unbounded', 'Manrope']) {
  const own = faces.filter((face) => face.family === family);
  const hasLatinExt = own.some((face) => face.subset === 'latin-ext');
  const hasGhe = own.some((face) => /U\+490-491/i.test(face.range));
  console.log(
    `  ${family}: latin-ext ${hasLatinExt ? 'yes' : 'NO'}, cyrillic ґ (U+0490–0491) ${hasGhe ? 'yes' : 'NO'}`,
  );
  ok &&= hasLatinExt && hasGhe;
}
console.log('');
if (!ok) process.exit(1);
