import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getCategories } from '~/content';
import { siteConfig } from '~/site.config';
import type * as RobotsModule from '@/app/robots';
import { isValidTelegramUsername, normalizeUsername } from '@/lib/configurator/telegram';
import type * as SitemapModule from '@/app/sitemap';
import type * as SitePathsModule from '@/lib/site-paths';
import type * as StructuredDataModule from '@/lib/structured-data';

/*
 * SEO files and structured data under a non-empty base path (GitHub Pages
 * project site). SITE_URL is resolved at module load, so the env is set
 * first and the modules are imported lazily.
 */
const SITE = 'https://user.github.io/kabaninno';
let sitemap: typeof SitemapModule.default;
let robots: typeof RobotsModule.default;
let structured: typeof StructuredDataModule;
let sitePaths: typeof SitePathsModule;

beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
  vi.resetModules();
  sitemap = (await import('@/app/sitemap')).default;
  robots = (await import('@/app/robots')).default;
  structured = await import('@/lib/structured-data');
  sitePaths = await import('@/lib/site-paths');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('sitemap.xml', () => {
  it('lists every page in every locale with hreflang alternates and x-default', () => {
    const entries = sitemap();
    const paths = sitePaths.getAllSitePaths();
    expect(entries).toHaveLength(paths.length * 3);
    for (const entry of entries) {
      expect(entry.url.startsWith(`${SITE}/`)).toBe(true);
      expect(entry.url.endsWith('/')).toBe(true);
      const languages = entry.alternates?.languages as Record<string, string>;
      expect(Object.keys(languages).sort()).toEqual(['en', 'pl', 'uk', 'x-default']);
      expect(languages['x-default']).toBe(languages.pl);
    }
    expect(entries.map((entry) => entry.url)).toContain(`${SITE}/uk/configurator/`);
  });
});

describe('robots.txt', () => {
  it('allows everything and points at the sitemap under the base path', () => {
    const result = robots();
    expect(result.sitemap).toBe(`${SITE}/sitemap.xml`);
    expect(result.rules).toMatchObject({ userAgent: '*', allow: '/' });
  });
});

describe('home JSON-LD', () => {
  const find = (graph: Record<string, unknown>[], type: string) =>
    graph.find((node) => node['@type'] === type)!;

  it('describes the studio without invented contacts or address', () => {
    const data = structured.homeJsonLd('pl') as { '@graph': Record<string, unknown>[] };
    const organization = find(data['@graph'], 'Organization');
    expect(organization.name).toBe('KABANINNO');
    expect(organization.url).toBe(`${SITE}/pl/`);
    expect(organization.image).toBe(`${SITE}/og/pl.png`);
    // sameAs only with a real Telegram username (never the placeholder).
    const telegram = normalizeUsername(siteConfig.telegramUsername);
    if (isValidTelegramUsername(telegram)) {
      expect(organization.sameAs).toEqual([`https://t.me/${telegram}`]);
    } else {
      expect(organization.sameAs).toBeUndefined();
    }
    const json = JSON.stringify(data);
    for (const key of ['address', 'telephone', 'email', 'geo', '[TELEGRAM', '[ДОМЕН']) {
      expect(json).not.toContain(key);
    }
    expect(find(data['@graph'], 'WebSite')).toMatchObject({ inLanguage: 'pl', url: `${SITE}/pl/` });
  });

  it('lists every category and service from content, per locale', () => {
    const data = structured.homeJsonLd('uk') as { '@graph': Record<string, unknown>[] };
    const catalog = find(data['@graph'], 'Organization').hasOfferCatalog as {
      itemListElement: { url: string; itemListElement: unknown[] }[];
    };
    const categories = getCategories();
    expect(catalog.itemListElement).toHaveLength(categories.length);
    catalog.itemListElement.forEach((group, index) => {
      expect(group.url).toBe(`${SITE}/uk/services/${categories[index]!.id}/`);
      expect(group.itemListElement).toHaveLength(categories[index]!.services.length);
    });
  });

  it('serialises safely for an inline script', () => {
    const text = structured.serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
