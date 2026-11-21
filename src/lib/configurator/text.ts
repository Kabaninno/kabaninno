/**
 * Text helpers for the lead message (pure).
 */

/**
 * No-break spaces → plain spaces (D35): typography adds U+00A0 after short
 * words, and number formatting uses U+00A0 / U+202F / U+2007 as group
 * separators ("15 000"). In a Telegram draft they only cost URL budget
 * (`%C2%A0` is 6 characters, a space is 3).
 */
export function normalizeSpaces(text: string): string {
  return text.replace(/[\u00A0\u202F\u2007]/g, ' ');
}

type SegmenterLike = {
  segment: (text: string) => Iterable<{ segment: string }>;
};

function defaultSegmenter(): SegmenterLike | null {
  return typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
}

/**
 * User-perceived characters (grapheme clusters): an emoji with modifiers or
 * a letter with combining marks is one unit, so cutting between units never
 * leaves a broken surrogate pair or a stray mark. Without `Intl.Segmenter`
 * it falls back to code points, attaching combining marks (\p{M}) and
 * joiners to the preceding character.
 */
export function graphemes(
  text: string,
  segmenter: SegmenterLike | null = defaultSegmenter(),
): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (part) => part.segment);
  const units: string[] = [];
  for (const char of Array.from(text)) {
    const last = units.length - 1;
    const joins = /^[\p{M}\u200D\uFE0F]$/u.test(char) || units[last]?.endsWith('\u200D');
    if (last >= 0 && joins) units[last] += char;
    else units.push(char);
  }
  return units;
}

/**
 * Keeps the first `count` grapheme clusters; when anything was cut, trailing
 * spaces are dropped and `ellipsis` is appended.
 */
export function truncateGraphemes(
  text: string,
  count: number,
  ellipsis = '…',
  segmenter?: SegmenterLike | null,
): string {
  const units = graphemes(text, segmenter);
  if (units.length <= count) return text;
  return `${units.slice(0, Math.max(0, count)).join('').trimEnd()}${ellipsis}`;
}
