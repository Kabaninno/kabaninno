import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/i18n/routing';
import {
  LOCALE_CODES,
  LOCALE_STORAGE_KEY,
  localeFromLanguages,
  rootRedirectScript,
} from './locale-choice';

describe('LOCALE_CODES', () => {
  it('shows Ukrainian as UA while the locale stays uk (D137)', () => {
    expect(LOCALE_CODES).toEqual({ pl: 'PL', en: 'EN', uk: 'UA' });
  });
});

describe('localeFromLanguages', () => {
  it('maps the browser languages: uk → uk, en → en, pl → pl', () => {
    expect(localeFromLanguages(['uk-UA'])).toBe('uk');
    expect(localeFromLanguages(['uk'])).toBe('uk');
    expect(localeFromLanguages(['en-GB'])).toBe('en');
    expect(localeFromLanguages(['pl-PL'])).toBe('pl');
  });

  it('takes the first language the site has, and falls back to Polish', () => {
    expect(localeFromLanguages(['de-DE', 'en-US'])).toBe('en');
    expect(localeFromLanguages(['ru-RU', 'uk'])).toBe('uk');
    expect(localeFromLanguages(['de'])).toBe('pl');
    expect(localeFromLanguages([])).toBe('pl');
    expect(localeFromLanguages(undefined)).toBe('pl');
  });

  it('treats the non-standard "ua" tag as Ukrainian', () => {
    expect(localeFromLanguages(['ua'])).toBe('uk');
  });
});

describe('rootRedirectScript (the inline script of /)', () => {
  const targets: Record<Locale, string> = {
    pl: '/kabaninno/pl/',
    en: '/kabaninno/en/',
    uk: '/kabaninno/uk/',
  };
  const script = rootRedirectScript(targets);

  /** Runs the script in a sandbox and returns the URL it navigates to. */
  function run({
    languages,
    language,
    stored,
    search = '',
    hash = '',
    storageThrows = false,
  }: {
    languages?: string[] | null;
    language?: string;
    stored?: string | null;
    search?: string;
    hash?: string;
    storageThrows?: boolean;
  }): string | null {
    let replaced: string | null = null;
    runInNewContext(script, {
      localStorage: {
        getItem(key: string) {
          if (storageThrows) throw new Error('blocked');
          return key === LOCALE_STORAGE_KEY && stored != null ? stored : null;
        },
      },
      navigator: { languages: languages ?? undefined, language },
      location: {
        search,
        hash,
        replace(url: string) {
          replaced = url;
        },
      },
    });
    return replaced;
  }

  it('contains no angle brackets, so postbuild can lift it out of the HTML', () => {
    expect(script).not.toMatch(/[<>]/);
  });

  it('follows the browser language: uk → /uk/, en → /en/, the rest → /pl/', () => {
    expect(run({ languages: ['uk-UA', 'en'] })).toBe('/kabaninno/uk/');
    expect(run({ languages: ['en-US'] })).toBe('/kabaninno/en/');
    expect(run({ languages: ['pl'] })).toBe('/kabaninno/pl/');
    expect(run({ languages: ['de-DE'] })).toBe('/kabaninno/pl/');
    expect(run({ languages: ['fr', 'en-GB'] })).toBe('/kabaninno/en/');
  });

  it('agrees with localeFromLanguages', () => {
    for (const languages of [['uk'], ['en-AU'], ['pl-PL'], ['ja'], ['ru', 'uk-UA'], ['ua']]) {
      expect(run({ languages })).toBe(targets[localeFromLanguages(languages)]);
    }
  });

  it('falls back to navigator.language when there is no languages list', () => {
    expect(run({ languages: null, language: 'uk' })).toBe('/kabaninno/uk/');
    expect(run({ languages: null, language: undefined })).toBe('/kabaninno/pl/');
  });

  it('prefers the remembered choice over the browser language', () => {
    expect(run({ languages: ['en-US'], stored: '"uk"' })).toBe('/kabaninno/uk/');
    expect(run({ languages: ['uk'], stored: '"pl"' })).toBe('/kabaninno/pl/');
  });

  it('ignores a corrupt or unknown stored value and blocked storage', () => {
    expect(run({ languages: ['en'], stored: '"xx"' })).toBe('/kabaninno/en/');
    expect(run({ languages: ['en'], stored: 'not json' })).toBe('/kabaninno/en/');
    expect(run({ languages: ['en'], stored: '"constructor"' })).toBe('/kabaninno/en/');
    expect(run({ languages: ['uk'], storageThrows: true })).toBe('/kabaninno/uk/');
  });

  it('keeps the query string and the hash', () => {
    expect(run({ languages: ['uk'], search: '?add=web%2Fseo', hash: '#top' })).toBe(
      '/kabaninno/uk/?add=web%2Fseo#top',
    );
  });
});
