/**
 * OKLab / OKLCH helpers (Björn Ottosson, 2020) on linear-sRGB triples — the
 * space three.js colours live in. Interpolating hues in OKLCH keeps lightness
 * and chroma steady, where an RGB lerp between complementary accents passes
 * through a dull grey (visual V2-07). Pure, three-free.
 */
export type Rgb = [number, number, number];
export type Lch = [number, number, number];

export function linearRgbToOklch([r, g, b]: Rgb): Lch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

export function oklchToLinearRgb([L, C, h]: Lch): Rgb {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * Interpolates two linear-sRGB colours along the shorter hue arc in OKLCH.
 * Chroma never drops below the smaller endpoint's, so the blend stays vivid.
 */
export function mixOklch(a: Rgb, b: Rgb, t: number): Rgb {
  const [la, ca, ha] = linearRgbToOklch(a);
  const [lb, cb, hb] = linearRgbToOklch(b);
  let dh = hb - ha;
  if (dh > Math.PI) dh -= Math.PI * 2;
  if (dh < -Math.PI) dh += Math.PI * 2;
  const chroma = Math.max(ca + (cb - ca) * t, Math.min(ca, cb));
  return oklchToLinearRgb([la + (lb - la) * t, chroma, ha + dh * t]);
}
