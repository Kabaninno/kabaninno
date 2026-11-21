import type { Locale } from '@/i18n/routing';

const NBSP = ' ';

/*
 * One-letter words that must not end a line (Polish typographic convention,
 * also common in Ukrainian typesetting). The lookbehind keeps the preceding
 * character, so runs like "i w domu" bind every letter.
 */
const SHORT_WORDS: Partial<Record<Locale, RegExp>> = {
  pl: /(?<=^|[\s („"«—–-])([aiouwz])\s+/giu,
  uk: /(?<=^|[\s („"«—–-])([аівузйоя])\s+/giu,
};

/**
 * Replaces the space after one-letter words with a non-breaking space, so a
 * heading never leaves "w", "i", "з", "й"… dangling at the end of a line.
 * Locales without the convention (en) are returned unchanged. Pure; safe to
 * use in server components for headings, leads and short texts.
 */
export function bindShortWords(text: string, locale: Locale): string {
  const pattern = SHORT_WORDS[locale];
  return pattern ? text.replace(pattern, `$1${NBSP}`) : text;
}
