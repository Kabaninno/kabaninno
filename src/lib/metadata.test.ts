import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as MetadataModule from './metadata';

// SITE_URL is resolved at module load, so set the env first and import lazily.
const SITE = 'https://user.github.io/kabaninno';
let metadata: typeof MetadataModule;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
  vi.resetModules();
  metadata = await import('./metadata');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('localizedPath', () => {
  it('prefixes the locale', () => {
    expect(metadata.localizedPath('pl', '/')).toBe('/pl/');
    expect(metadata.localizedPath('en', '/services/web/')).toBe('/en/services/web/');
    expect(metadata.localizedPath('uk', '/portfolio/')).toBe('/uk/portfolio/');
  });
});

describe('languageAlternates', () => {
  it('lists every locale plus x-default (the default locale)', () => {
    expect(metadata.languageAlternates('/services/web/')).toEqual({
      pl: `${SITE}/pl/services/web/`,
      en: `${SITE}/en/services/web/`,
      uk: `${SITE}/uk/services/web/`,
      'x-default': `${SITE}/pl/services/web/`,
    });
  });

  it('handles the home path', () => {
    const alternates = metadata.languageAlternates('/');
    expect(alternates['x-default']).toBe(`${SITE}/pl/`);
    expect(Object.keys(alternates).sort()).toEqual(['en', 'pl', 'uk', 'x-default']);
  });
});

describe('buildPageMetadata', () => {
  it('sets canonical, hreflang and Open Graph for the page locale', () => {
    const result = metadata.buildPageMetadata({
      locale: 'en',
      path: '/configurator/',
      title: 'Build your request',
      description: 'Description',
    });
    expect(result.title).toBe('Build your request');
    expect(result.alternates?.canonical).toBe(`${SITE}/en/configurator/`);
    expect(result.alternates?.languages).toMatchObject({ 'x-default': `${SITE}/pl/configurator/` });
    expect(result.openGraph).toMatchObject({
      url: `${SITE}/en/configurator/`,
      locale: 'en_US',
      alternateLocale: ['pl_PL', 'uk_UA'],
    });
    expect(result.robots).toBeUndefined();
  });

  it('supports absolute titles and noindex', () => {
    const result = metadata.buildPageMetadata({
      locale: 'pl',
      path: '/',
      title: 'Home',
      description: 'd',
      absoluteTitle: true,
      noIndex: true,
    });
    expect(result.title).toEqual({ absolute: 'Home' });
    expect(result.robots).toEqual({ index: false, follow: true });
  });
});

describe('Open Graph images', () => {
  it('points every locale at its own PNG under the base path', () => {
    for (const locale of ['pl', 'en', 'uk'] as const) {
      const image = metadata.ogImage(locale);
      expect(image.url).toBe(`${SITE}/og/${locale}.png`);
      expect(image).toMatchObject({ width: 1200, height: 630, type: 'image/png' });
      expect(image.alt).toContain('KABANINNO');
      expect(image.alt).not.toContain('{studio}');
    }
  });

  it('is part of the page metadata (Open Graph and Twitter)', () => {
    const result = metadata.buildPageMetadata({
      locale: 'uk',
      path: '/portfolio/',
      title: 'Портфоліо',
      description: 'd',
    });
    const og = result.openGraph as { images?: { url: string }[] };
    expect(og.images?.[0]?.url).toBe(`${SITE}/og/uk.png`);
    const twitter = result.twitter as { images?: { url: string }[] };
    expect(twitter.images?.[0]?.url).toBe(`${SITE}/og/uk.png`);
  });
});
