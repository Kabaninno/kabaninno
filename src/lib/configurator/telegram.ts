import { graphemes, normalizeSpaces, truncateGraphemes } from './text';

/**
 * Telegram deep link to a personal chat with a prefilled draft (PLAN §3,
 * verified on core.telegram.org/api/links):
 *   https://t.me/<username>?text=<encodeURIComponent(draft)>
 * The text becomes a draft in the input field; the visitor sends it. If the
 * text starts with "@" a space is prepended. The client itself cuts the text
 * to `message_length_max` (4096), far above our budget.
 */

/**
 * Budget for the whole URL, in characters. Conservative on purpose:
 * - on desktop, t.me hands the link to Telegram Desktop as a `tg://resolve?…`
 *   URL through the OS protocol handler, and Windows shell APIs cap URLs at
 *   INTERNET_MAX_URL_LENGTH (2083) characters;
 * - ~2000 characters is the long-standing interoperability limit for URLs
 *   (old browsers, proxies, link previews, the sitemap protocol's 2048).
 * Cyrillic letters encode to 6 characters each, so this fits roughly 1200
 * characters of Polish text or about 330 of Ukrainian: hence the compact
 * format and comment trimming, and the copy fallback that is always shown.
 */
export const TELEGRAM_URL_BUDGET = 2000;

/** Telegram usernames: 5–32 characters, Latin letters, digits and "_", starting with a letter. */
export function isValidTelegramUsername(username: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username);
}

/** "@studio " → "studio". */
export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, '');
}

/** The text as it goes into the link: plain spaces, and a space before a leading "@". */
export function telegramText(text: string): string {
  const normalized = normalizeSpaces(text);
  return normalized.startsWith('@') ? ` ${normalized}` : normalized;
}

export function telegramUrl(username: string, text: string): string {
  return `https://t.me/${normalizeUsername(username)}?text=${encodeURIComponent(telegramText(text))}`;
}

export function fitsTelegramBudget(
  username: string,
  text: string,
  maxUrlLength: number = TELEGRAM_URL_BUDGET,
): boolean {
  return telegramUrl(username, text).length <= maxUrlLength;
}

/**
 * The longest grapheme-safe prefix of `text` (plus "…") whose link fits the
 * budget. Binary search over grapheme clusters; `truncated` tells the UI to
 * offer the full text through "Copy".
 */
export function fitTextToTelegramUrl(
  username: string,
  text: string,
  maxUrlLength: number = TELEGRAM_URL_BUDGET,
): { text: string; truncated: boolean } {
  if (fitsTelegramBudget(username, text, maxUrlLength)) return { text, truncated: false };
  const units = graphemes(text);
  let low = 0;
  let high = units.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fitsTelegramBudget(username, truncateGraphemes(text, middle), maxUrlLength)) low = middle;
    else high = middle - 1;
  }
  return { text: truncateGraphemes(text, low), truncated: true };
}
