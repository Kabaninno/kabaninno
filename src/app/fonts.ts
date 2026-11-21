import { JetBrains_Mono, Manrope, Unbounded } from 'next/font/google';

/*
 * Self-hosted variable fonts (downloaded at build time by next/font).
 *
 * How subsets work with next/font/google: the generated CSS always contains
 * one @font-face per subset the family offers, each with a `unicode-range`, so
 * browsers download only the files whose glyphs a page actually renders. The
 * `subsets` option only selects which files get a <link rel="preload">.
 * Every glyph range we need is therefore always available:
 * - latin-ext: Polish ą ę ł ż ź ś ć ń (ó is in latin);
 * - cyrillic: Ukrainian ї є ґ і (Google's "cyrillic" range includes U+0490–0491).
 *
 * Preloading is kept to what nearly every page needs (measured, see
 * `node scripts/font-report.mjs`):
 * - Unbounded: latin only. Its latin-ext file is ~115 KB (full weight axis;
 *   Google does not subset the axis for this family), so it loads on demand
 *   instead of being forced on EN/UK visitors.
 * - Manrope: latin + latin-ext (body text; Polish is the primary locale).
 * - Cyrillic files load on demand on /uk/ pages.
 * - JetBrains Mono: latin only, not preloaded (tiny digit labels, not LCP).
 *   Use it for digits and latin codes ("01 / 05", "PL") only — never for
 *   localized words.
 */

export const unbounded = Unbounded({
  subsets: ['latin'],
  variable: '--font-unbounded',
  display: 'swap',
  fallback: ['Geologica', 'system-ui', 'sans-serif'],
});

export const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
});

/** Class names that define the three font CSS variables (apply on <html>). */
export const fontVariables = `${unbounded.variable} ${manrope.variable} ${jetbrainsMono.variable}`;
