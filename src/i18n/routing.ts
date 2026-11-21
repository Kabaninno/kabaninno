import { defineRouting } from 'next-intl/routing';

export const locales = ['pl', 'en', 'uk'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pl';

/**
 * Static export: no proxy/middleware, so every URL carries its locale prefix
 * (`/pl/...`, `/en/...`, `/uk/...`) and `/` is a static redirect page.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // No proxy reads a locale cookie on a static host, so do not write one.
  localeCookie: false,
});

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
