import { TELEGRAM_URL_BUDGET, fitTextToUrl } from './telegram';
import { normalizeSpaces } from './text';

/**
 * WhatsApp "click to chat" link with a prefilled message (round 3, B4, D157):
 *   https://wa.me/<number>?text=<encodeURIComponent(text)>
 * `number` is the full international number, digits only, without "+", as in
 * `siteConfig.whatsappNumber`; an empty or malformed number means "not
 * configured" and the button is not shown.
 */

/** The same budget as Telegram: on desktop the link reaches the app through the OS URL handler. */
export const WHATSAPP_URL_BUDGET = TELEGRAM_URL_BUDGET;

/** E.164 without "+": a country code and up to 15 digits in total, no leading zero. */
export function isValidWhatsappNumber(number: string): boolean {
  return /^[1-9]\d{7,14}$/.test(number);
}

export function whatsappUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(normalizeSpaces(text))}`;
}

export interface PreparedWhatsappLink {
  url: string;
  /** The text in the link (the full one, or a shortened one with "…"). */
  text: string;
  truncated: boolean;
}

/** The link for this text within the budget, or null when the number is not configured. */
export function prepareWhatsappLink(
  number: string,
  text: string,
  maxUrlLength: number = WHATSAPP_URL_BUDGET,
): PreparedWhatsappLink | null {
  if (!isValidWhatsappNumber(number)) return null;
  const fitted = fitTextToUrl(text, (candidate) => whatsappUrl(number, candidate), maxUrlLength);
  return { url: whatsappUrl(number, fitted.text), ...fitted };
}
