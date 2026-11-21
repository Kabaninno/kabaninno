#!/usr/bin/env node
/**
 * Writes the gallery placeholders of the stub portfolio cases into
 * public/portfolio/<slug>/<n>.svg: abstract, in the brand palette and the
 * case's category colors, framed by a dashed border and a faint cross (the
 * conventional "placeholder" sign), with no text to translate. Deterministic,
 * a few KB each. Re-run after changing the list; replace with real images
 * when the cases are real (and update `gallery` in content/projects.ts).
 *
 *   node scripts/portfolio-placeholders.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const WIDTH = 1200;
const HEIGHT = 750;

/** Category DNA colors (content/categories.ts). */
const COLOR = {
  web: '#4FF0D2',
  crm: '#FF6B8B',
  automation: '#FFA53B',
  ai: '#B57BFF',
  telegram: '#4AA8FF',
};

const CASES = [
  {
    slug: 'bakery-telegram-orders',
    colors: [COLOR.telegram, COLOR.web],
    kinds: ['interface', 'network', 'chart'],
  },
  {
    slug: 'dental-clinic-crm',
    colors: [COLOR.crm, COLOR.automation],
    kinds: ['chart', 'interface'],
  },
  {
    slug: 'logistics-document-ai',
    colors: [COLOR.ai, COLOR.automation],
    kinds: ['network', 'interface'],
  },
  {
    slug: 'fitness-studio-platform',
    colors: [COLOR.web, COLOR.telegram],
    kinds: ['interface', 'chart', 'network'],
  },
];

/** mulberry32: the same picture on every run. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (text) =>
  [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
const round = (value) => Math.round(value);

function interfaceShapes(rnd, [a, b]) {
  const cards = [];
  for (let i = 0; i < 6; i += 1) {
    const x = 330 + (i % 3) * 270;
    const y = 150 + Math.floor(i / 3) * 250;
    const h = 150 + round(rnd() * 60);
    cards.push(
      `<rect x="${x}" y="${y}" width="240" height="${h}" rx="18" fill="${i % 2 ? b : a}" fill-opacity=".1" stroke="${i % 2 ? b : a}" stroke-opacity=".45"/>`,
      `<rect x="${x + 22}" y="${y + 26}" width="${round(80 + rnd() * 110)}" height="10" rx="5" fill="#E8ECF5" fill-opacity=".35"/>`,
      `<rect x="${x + 22}" y="${y + 48}" width="${round(60 + rnd() * 90)}" height="8" rx="4" fill="#E8ECF5" fill-opacity=".18"/>`,
    );
  }
  return [
    `<rect x="80" y="110" width="200" height="530" rx="22" fill="#E8ECF5" fill-opacity=".04" stroke="#E8ECF5" stroke-opacity=".12"/>`,
    ...[0, 1, 2, 3, 4].map(
      (i) =>
        `<rect x="108" y="${150 + i * 56}" width="${round(90 + rnd() * 60)}" height="12" rx="6" fill="${i === 1 ? a : '#E8ECF5'}" fill-opacity="${i === 1 ? '.7' : '.2'}"/>`,
    ),
    ...cards,
  ];
}

function networkShapes(rnd, [a, b]) {
  const nodes = Array.from({ length: 9 }, (_, i) => ({
    x: round(170 + rnd() * 860),
    y: round(130 + rnd() * 490),
    r: round(10 + rnd() * 22),
    color: i % 3 === 0 ? b : a,
  }));
  const links = [];
  for (let i = 1; i < nodes.length; i += 1) {
    const from = nodes[i];
    const to = nodes[Math.floor(rnd() * i)];
    links.push(
      `<path d="M${from.x} ${from.y}L${to.x} ${to.y}" stroke="${from.color}" stroke-opacity=".35" stroke-width="2"/>`,
    );
  }
  const dots = nodes.map(
    (node) =>
      `<circle cx="${node.x}" cy="${node.y}" r="${round(node.r * 2.4)}" fill="${node.color}" fill-opacity=".08"/><circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="${node.color}" fill-opacity=".75"/><circle cx="${node.x}" cy="${node.y}" r="${round(node.r * 0.4)}" fill="#fff" fill-opacity=".85"/>`,
  );
  return [...links, ...dots];
}

function chartShapes(rnd, [a, b]) {
  const bars = Array.from({ length: 10 }, (_, i) => {
    const h = round(90 + rnd() * 330);
    return `<rect x="${170 + i * 88}" y="${590 - h}" width="52" height="${h}" rx="10" fill="${i % 4 === 3 ? b : a}" fill-opacity="${i % 4 === 3 ? '.75' : '.45'}"/>`;
  });
  const points = Array.from(
    { length: 10 },
    (_, i) => `${196 + i * 88},${round(170 + rnd() * 200)}`,
  );
  return [
    `<path d="M140 590H1060" stroke="#E8ECF5" stroke-opacity=".2"/>`,
    ...bars,
    `<polyline points="${points.join(' ')}" fill="none" stroke="#E8ECF5" stroke-opacity=".7" stroke-width="3" stroke-linejoin="round"/>`,
    ...points.map((point) => {
      const [x, y] = point.split(',');
      return `<circle cx="${x}" cy="${y}" r="6" fill="#05070D" stroke="#E8ECF5" stroke-opacity=".8" stroke-width="2"/>`;
    }),
  ];
}

const SHAPES = { interface: interfaceShapes, network: networkShapes, chart: chartShapes };

function svg(slug, index, kind, colors) {
  const rnd = random(hash(`${slug}/${index}`));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<defs><radialGradient id="g" cx="${round(20 + rnd() * 60)}%" cy="${round(15 + rnd() * 30)}%" r="85%"><stop offset="0" stop-color="${colors[0]}" stop-opacity=".28"/><stop offset="1" stop-color="#05070D" stop-opacity="0"/></radialGradient>`,
    `<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#fff" stroke-opacity=".045"/></pattern></defs>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0A1024"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#p)"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>`,
    ...SHAPES[kind](rnd, colors),
    `<path d="M24 24L${WIDTH - 24} ${HEIGHT - 24}M${WIDTH - 24} 24L24 ${HEIGHT - 24}" stroke="#fff" stroke-opacity=".04"/>`,
    `<rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" rx="24" fill="none" stroke="#fff" stroke-opacity=".2" stroke-dasharray="12 12"/>`,
    '</svg>',
    '',
  ].join('\n');
}

for (const { slug, colors, kinds } of CASES) {
  const dir = join(root, 'public', 'portfolio', slug);
  mkdirSync(dir, { recursive: true });
  kinds.forEach((kind, i) => {
    const file = join(dir, `${i + 1}.svg`);
    const content = svg(slug, i + 1, kind, colors);
    writeFileSync(file, content);
    console.log(`${file.slice(root.length)} ${(content.length / 1024).toFixed(1)} KB`);
  });
}
