import { describe, expect, it } from 'vitest';
import { NOT_FOUND_SKY, starLayer, starTileSvg, svgDataUri } from './starfield';

const options = {
  size: 500,
  count: 40,
  seed: 7,
  radius: [0.5, 1] as const,
  opacity: [0.4, 0.9] as const,
};

describe('starTileSvg', () => {
  it('is deterministic for a seed', () => {
    expect(starTileSvg(options)).toBe(starTileSvg(options));
    expect(starTileSvg(options)).not.toBe(starTileSvg({ ...options, seed: 8 }));
  });

  it('draws the requested number of stars inside the tile and ranges', () => {
    const svg = starTileSvg(options);
    const circles = [
      ...svg.matchAll(/cx='([\d.]+)' cy='([\d.]+)' r='([\d.]+)' opacity='([\d.]+)'/g),
    ];
    expect(circles).toHaveLength(options.count);
    for (const [, cx, cy, r, alpha] of circles) {
      expect(Number(cx)).toBeGreaterThanOrEqual(0);
      expect(Number(cx)).toBeLessThanOrEqual(options.size);
      expect(Number(cy)).toBeGreaterThanOrEqual(0);
      expect(Number(cy)).toBeLessThanOrEqual(options.size);
      expect(Number(r)).toBeGreaterThanOrEqual(0.5);
      expect(Number(r)).toBeLessThanOrEqual(1);
      expect(Number(alpha)).toBeGreaterThanOrEqual(0.4);
      expect(Number(alpha)).toBeLessThanOrEqual(0.9);
    }
  });
});

describe('svgDataUri', () => {
  it('escapes the characters that break a CSS url("…")', () => {
    const uri = svgDataUri(`<svg a="#1"></svg>`);
    expect(uri).toBe("data:image/svg+xml,%3Csvg a='%231'%3E%3C/svg%3E");
    expect(uri).not.toMatch(/[<>"#]/);
  });
});

describe('NOT_FOUND_SKY', () => {
  it('uses co-prime tile sizes', () => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const [a, b] = NOT_FOUND_SKY.map((layer) => layer.size);
    expect(gcd(a!, b!)).toBe(1);
  });

  it('builds CSS-ready layers', () => {
    const layer = starLayer(NOT_FOUND_SKY[0]!);
    expect(layer.image.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(layer.image.endsWith('")')).toBe(true);
    expect(layer.size).toBe('1201px 1201px');
  });
});
