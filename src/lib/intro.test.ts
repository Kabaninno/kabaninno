import { describe, expect, it } from 'vitest';
import { isIntroEligible, isLocaleHomePath, keySkipsIntro } from './intro';

describe('isIntroEligible', () => {
  const base = { home: true, seen: false, reducedMotion: false, simple: false };

  it('plays on the first visit to a home page', () => {
    expect(isIntroEligible(base)).toBe(true);
  });

  it('never plays elsewhere, twice, under reduced motion or in simple mode', () => {
    expect(isIntroEligible({ ...base, home: false })).toBe(false);
    expect(isIntroEligible({ ...base, seen: true })).toBe(false);
    expect(isIntroEligible({ ...base, reducedMotion: true })).toBe(false);
    expect(isIntroEligible({ ...base, simple: true })).toBe(false);
  });
});

describe('isLocaleHomePath', () => {
  it('recognises the locale homes under the base path', () => {
    expect(isLocaleHomePath('/kabaninno/pl/', '/kabaninno')).toBe(true);
    expect(isLocaleHomePath('/kabaninno/uk', '/kabaninno')).toBe(true);
    expect(isLocaleHomePath('/en/', '')).toBe(true);
  });

  it('rejects other routes, unknown locales and paths outside the base path', () => {
    expect(isLocaleHomePath('/kabaninno/pl/services/web/', '/kabaninno')).toBe(false);
    expect(isLocaleHomePath('/kabaninno/', '/kabaninno')).toBe(false);
    expect(isLocaleHomePath('/kabaninno/de/', '/kabaninno')).toBe(false);
    expect(isLocaleHomePath('/pl/', '/kabaninno')).toBe(false);
    expect(isLocaleHomePath('/', '')).toBe(false);
  });
});

describe('keySkipsIntro', () => {
  it('skips on ordinary keys, Escape included', () => {
    for (const key of ['Escape', 'Enter', ' ', 'Tab', 'a', 'ArrowRight']) {
      expect(keySkipsIntro(key)).toBe(true);
    }
  });

  it('ignores a lone modifier', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta']) expect(keySkipsIntro(key)).toBe(false);
  });
});
