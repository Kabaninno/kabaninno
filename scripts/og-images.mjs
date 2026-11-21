#!/usr/bin/env node
/**
 * Generates the Open Graph images, one per locale (1200×630 PNG):
 * public/og/<locale>.png. They are static files, so they work in the static
 * export under any base path (`ogImage()` in src/lib/metadata.ts builds the
 * absolute URLs). Committed to the repo; re-run after changing the home
 * texts, the category colours/names or the layout:
 *
 *   npm run og:images
 *
 * - Texts: `home.eyebrow` and `home.title` from messages/<locale>/ui.json,
 *   category names from messages/<locale>/content.json.
 * - Constellation: the same data and projection as the simple-mode backdrop
 *   (content/categories.ts → src/scene/layout.ts → src/lib/simple-sky.ts,
 *   imported directly thanks to Node's TypeScript type stripping).
 * - Fonts: Unbounded and Manrope (OFL) as full TTFs from Google Fonts,
 *   downloaded into memory at generation time (satori cannot read WOFF2).
 * - Renderer: `next/og` (satori + resvg), no browser needed.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';
import { categoriesData } from '../content/categories.ts';
import {
  CONFIGURATOR_POSITION,
  PORTFOLIO_POSITION,
  layoutCategoryNodes,
} from '../src/scene/layout.ts';
import { buildConstellation } from '../src/lib/simple-sky.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
// Every locale with dictionaries (messages/<locale>/ui.json), so a new language needs no edit here.
const LOCALES = readdirSync(join(root, 'messages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const WIDTH = 1200;
const HEIGHT = 630;
const COLORS = {
  void: '#05070d',
  deep: '#0a1024',
  ink: '#e8ecf5',
  muted: '#9aa4bf',
  brand: '#4ff0d2',
  nebula: '#b57bff',
  portfolio: '#DDE6FF',
};
const STUDIO = /studioName:\s*'([^']+)'/.exec(
  readFileSync(join(root, 'site.config.ts'), 'utf8'),
)?.[1];

/** Full TTF of a Google font (the CSS API serves TTF to clients without a modern User-Agent). */
async function googleFont(family, weight) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
  ).then((response) => response.text());
  const url = /src:\s*url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
  if (!url) throw new Error(`No TTF source for ${family} ${weight}`);
  return fetch(url).then((response) => response.arrayBuffer());
}

const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf8'));
const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

function constellationSvg() {
  const positions = layoutCategoryNodes(
    categoriesData.length,
    categoriesData.map((category) => category.dna.universePosition),
  );
  const sky = buildConstellation({
    categories: categoriesData.map((category, index) => ({
      id: category.id,
      color: category.dna.color,
      position: positions[index],
    })),
    portfolio: { color: COLORS.portfolio, position: PORTFOLIO_POSITION },
    configurator: { color: COLORS.brand, position: CONFIGURATOR_POSITION },
  });
  const lines = sky.links
    .map(([a, b]) => {
      const [p, q] = [sky.nodes[a], sky.nodes[b]];
      return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`;
    })
    .join('');
  const nodes = sky.nodes
    .map((node) => {
      const halo =
        `<circle cx="${node.x}" cy="${node.y}" r="${node.r * 6}" fill="${node.color}" opacity="0.08"/>` +
        `<circle cx="${node.x}" cy="${node.y}" r="${node.r * 2.6}" fill="${node.color}" opacity="0.2"/>`;
      if (node.kind === 'configurator') {
        const s = node.r * 1.9;
        return `${halo}<rect x="${node.x - s / 2}" y="${node.y - s / 2}" width="${s}" height="${s}" transform="rotate(45 ${node.x} ${node.y})" fill="none" stroke="${node.color}" stroke-width="3"/>`;
      }
      const ring =
        node.kind === 'portfolio'
          ? `<circle cx="${node.x}" cy="${node.y}" r="${node.r * 2}" fill="none" stroke="${node.color}" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="4 6"/>`
          : '';
      return `${halo}${ring}<circle cx="${node.x}" cy="${node.y}" r="${node.r * 1.3}" fill="${node.color}"/>`;
    })
    .join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sky.width} ${sky.height}" width="${sky.width}" height="${sky.height}"><g stroke="rgb(255,255,255)" stroke-opacity="0.2" stroke-width="2">${lines}</g>${nodes}</svg>`,
    aspect: sky.width / sky.height,
  };
}

function card({ eyebrow, title, categories, constellation, stars }) {
  // Top-right, clear of the text block (bottom-left) and the wordmark.
  const skyWidth = 480;
  const skyHeight = Math.round(skyWidth / constellation.aspect);
  return h(
    'div',
    {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        position: 'relative',
        backgroundColor: COLORS.void,
        backgroundImage: `radial-gradient(circle at 72% 30%, ${COLORS.deep} 0%, rgba(10,16,36,0) 55%), radial-gradient(circle at 92% 100%, rgba(181,123,255,0.12) 0%, rgba(181,123,255,0) 45%), radial-gradient(circle at 0% 0%, rgba(79,240,210,0.08) 0%, rgba(79,240,210,0) 40%)`,
        fontFamily: 'Manrope',
        color: COLORS.ink,
      },
    },
    h('img', {
      src: stars,
      width: WIDTH,
      height: HEIGHT,
      style: { position: 'absolute', top: 0, left: 0, opacity: 0.8 },
    }),
    h('img', {
      src: dataUri(constellation.svg),
      width: skyWidth,
      height: skyHeight,
      style: { position: 'absolute', right: 56, top: 44 },
    }),
    h(
      'div',
      {
        style: {
          position: 'absolute',
          left: 72,
          top: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        },
      },
      h('div', {
        style: {
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: COLORS.brand,
          boxShadow: `0 0 24px ${COLORS.brand}`,
        },
      }),
      h(
        'div',
        { style: { fontFamily: 'Unbounded', fontSize: 26, letterSpacing: 6, color: COLORS.ink } },
        STUDIO,
      ),
    ),
    h(
      'div',
      {
        style: {
          position: 'absolute',
          left: 72,
          bottom: 64,
          width: 760,
          display: 'flex',
          flexDirection: 'column',
        },
      },
      h(
        'div',
        {
          style: {
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 3.5,
            textTransform: 'uppercase',
            color: COLORS.muted,
          },
        },
        eyebrow,
      ),
      h(
        'div',
        {
          style: {
            marginTop: 18,
            fontFamily: 'Unbounded',
            fontSize: 58,
            lineHeight: 1.14,
            letterSpacing: -0.5,
          },
        },
        title,
      ),
      h(
        'div',
        { style: { marginTop: 34, display: 'flex', flexWrap: 'wrap', gap: 10 } },
        ...categories.map((category) =>
          h(
            'div',
            {
              key: category.id,
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(10,14,28,0.6)',
                fontSize: 18,
                color: COLORS.ink,
              },
            },
            h('div', {
              style: { width: 9, height: 9, borderRadius: 5, backgroundColor: category.color },
            }),
            category.name,
          ),
        ),
      ),
    ),
  );
}

const [unbounded, manrope, manropeSemi] = await Promise.all([
  googleFont('Unbounded', 500),
  googleFont('Manrope', 500),
  googleFont('Manrope', 600),
]);
const fonts = [
  { name: 'Unbounded', data: unbounded, weight: 500, style: 'normal' },
  { name: 'Manrope', data: manrope, weight: 500, style: 'normal' },
  { name: 'Manrope', data: manropeSemi, weight: 600, style: 'normal' },
];
const constellation = constellationSvg();
const stars = dataUri(readFileSync(join(root, 'public', 'sky', 'stars-near.svg'), 'utf8'));
const outDir = join(root, 'public', 'og');
mkdirSync(outDir, { recursive: true });

for (const locale of LOCALES) {
  const ui = readJson('messages', locale, 'ui.json');
  const content = readJson('messages', locale, 'content.json');
  const element = card({
    eyebrow: ui.home.eyebrow,
    title: ui.home.title,
    categories: categoriesData.map((category) => ({
      id: category.id,
      color: category.dna.color,
      name: content.categories[category.id].name,
    })),
    constellation,
    stars,
  });
  const response = new ImageResponse(element, { width: WIDTH, height: HEIGHT, fonts });
  const png = Buffer.from(await response.arrayBuffer());
  writeFileSync(join(outDir, `${locale}.png`), png);
  console.log(`[og-images] public/og/${locale}.png (${Math.round(png.length / 1024)} KB)`);
}
