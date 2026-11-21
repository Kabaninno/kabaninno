import { defaultLocale, locales, type Locale } from '@/i18n/routing';
import { safeStorage } from './storage';

/**
 * Language choice (D137).
 *
 * - Display codes: the Ukrainian locale is `uk` in lang / hreflang / URLs, but
 *   it is shown as "UA" everywhere a code is visible.
 * - The visitor's explicit choice is remembered in localStorage; the root page
 *   (`/`) reads it, falls back to the browser's languages, then to Polish.
 *   Direct links to `/pl/…` are never redirected.
 */

/** Visible short code of a locale ("UA" for `uk`). */
export const LOCALE_CODES: Record<Locale, string> = { pl: 'PL', en: 'EN', uk: 'UA' };

/** localStorage key of the remembered locale (a JSON string, e.g. `"uk"`). */
export const LOCALE_STORAGE_KEY = 'kabaninno.locale.v1';

function isKnownLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/**
 * Locale for a visitor without a stored choice: the first of the browser's
 * languages that the site has (`uk-UA` → uk, `en-GB` → en, `pl` → pl); any
 * other language ends at Polish. Pure; the root page runs the same rule
 * inline (`rootRedirectScript`), kept in sync by tests.
 */
export function localeFromLanguages(languages: readonly string[] | null | undefined): Locale {
  for (const language of languages ?? []) {
    const primary = String(language).toLowerCase().split('-')[0] ?? '';
    // "ua" is not a language code, but some browsers report it for Ukrainian.
    const candidate = primary === 'ua' ? 'uk' : primary;
    if (isKnownLocale(candidate)) return candidate;
  }
  return defaultLocale;
}

/** Remembers the visitor's explicit choice (never throws). */
export function rememberLocale(locale: Locale): void {
  safeStorage.setJSON(LOCALE_STORAGE_KEY, locale);
}

/** The remembered locale, if any. */
export function storedLocale(): Locale | null {
  return safeStorage.getJSON(LOCALE_STORAGE_KEY, (value) => (isKnownLocale(value) ? value : null));
}

/**
 * The inline script of the root page (`/`): picks the locale (stored choice →
 * browser languages → Polish) and replaces the location with that locale's
 * home, keeping ?query and #hash (deep links, campaigns). `targets` maps each
 * locale to its (base-path-aware) home URL. ES5, no `<` or `>` characters, so
 * postbuild can lift it out of the exported HTML safely.
 */
export function rootRedirectScript(targets: Record<Locale, string>): string {
  const codes = JSON.stringify({ ...targets });
  return (
    '(function(){var t=' +
    codes +
    ',l=null;' +
    'try{var s=JSON.parse(localStorage.getItem(' +
    JSON.stringify(LOCALE_STORAGE_KEY) +
    '));if(s&&t.hasOwnProperty(s))l=s}catch(e){}' +
    'if(!l){var a=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];' +
    'for(var i=0;i!==a.length&&!l;i++){var c=String(a[i]).toLowerCase().split("-")[0];' +
    'if(c==="ua")c="uk";if(t.hasOwnProperty(c))l=c}}' +
    'location.replace(t[l||' +
    JSON.stringify(defaultLocale) +
    ']+location.search+location.hash)})();'
  );
}
