import { createRandom } from '@/scene/random';

/**
 * CSS star layers for pages without the 3D scene (404): seeded random star
 * tiles rendered as inline SVG data URIs at build time. Random positions
 * inside one large tile leave no visible lattice (visual M3-01: tiny tiles
 * with one or a few stars each lined up in rows and columns), and the two
 * layers have co-prime sizes, so even the tile edges never line up.
 */

export interface StarTileOptions {
  /** Tile edge in CSS px. */
  size: number;
  count: number;
  seed: number;
  /** Radius range in px. */
  radius: readonly [number, number];
  /** Opacity range 0..1. */
  opacity: readonly [number, number];
}

export interface StarLayer {
  /** `url("data:image/svg+xml,…")` for `background-image`. */
  image: string;
  /** `<size>px <size>px` for `background-size`. */
  size: string;
}

/** Compact number: no trailing zeros, no leading "0" before the point (".62"). */
const short = (value: number, digits: number) =>
  String(Number(value.toFixed(digits))).replace(/^0\./, '.');

/**
 * SVG markup of one tile: single quotes and no `#`, so it fits a data URI
 * cheaply; white is inherited from the root, only tinted stars set a fill.
 */
export function starTileSvg({ size, count, seed, radius, opacity }: StarTileOptions): string {
  const random = createRandom(seed);
  const between = ([min, max]: readonly [number, number]) => min + (max - min) * random();
  let circles = '';
  for (let index = 0; index < count; index += 1) {
    const x = Math.round(random() * size);
    const y = Math.round(random() * size);
    const r = short(between(radius), 2);
    const alpha = short(between(opacity), 2);
    // A faint blue tint on some stars, like the WebGL starfield.
    const tint = random() < 0.25 ? " fill='rgb(214,226,255)'" : '';
    circles += `<circle cx='${x}' cy='${y}' r='${r}' opacity='${alpha}'${tint}/>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' fill='white'>${circles}</svg>`;
}

/** Minimal escaping for an SVG inside `url("data:image/svg+xml,…")`. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/"/g, "'")}`;
}

export function starLayer(options: StarTileOptions): StarLayer {
  return {
    image: `url("${svgDataUri(starTileSvg(options))}")`,
    size: `${options.size}px ${options.size}px`,
  };
}

/**
 * The 404 sky: a dense layer of faint small stars and a sparse layer of
 * brighter ones. Density matches the previous CSS layers (~150 stars on a
 * 1440×900 screen).
 */
export const NOT_FOUND_SKY: readonly StarTileOptions[] = [
  { size: 1201, count: 160, seed: 404, radius: [0.45, 0.8], opacity: [0.35, 0.85] },
  { size: 1597, count: 34, seed: 4040, radius: [0.8, 1.15], opacity: [0.55, 0.9] },
];
