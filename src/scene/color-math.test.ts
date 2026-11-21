import { describe, expect, it } from 'vitest';
import { linearRgbToOklch, mixOklch, oklchToLinearRgb, type Rgb } from './color-math';

/** sRGB hex → linear-sRGB triple (what three.js Color stores). */
function linear(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel((n >> 16) & 255), channel((n >> 8) & 255), channel(n & 255)];
}

describe('OKLCH helpers', () => {
  it('round-trips colours', () => {
    for (const hex of ['#4FF0D2', '#FF6B8B', '#FFA53B', '#B57BFF', '#4AA8FF']) {
      const rgb = linear(hex);
      oklchToLinearRgb(linearRgbToOklch(rgb)).forEach((v, i) => expect(v).toBeCloseTo(rgb[i]!, 4));
    }
  });

  it('keeps the blend of two DNA accents vivid (no grey midpoint, V2-07)', () => {
    const teal = linear('#4FF0D2');
    const pink = linear('#FF6B8B');
    const minChroma = Math.min(linearRgbToOklch(teal)[1], linearRgbToOklch(pink)[1]);
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const [, chroma] = linearRgbToOklch(mixOklch(teal, pink, t));
      // Gamut clipping may trim chroma a little, never towards grey.
      expect(chroma).toBeGreaterThan(minChroma * 0.6);
    }
    // An RGB lerp of the same pair does go dull at the midpoint.
    const rgbMid = teal.map((v, i) => (v + pink[i]!) / 2) as Rgb;
    expect(linearRgbToOklch(rgbMid)[1]).toBeLessThan(minChroma * 0.6);
  });
});
