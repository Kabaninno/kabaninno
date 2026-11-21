import { describe, expect, it } from 'vitest';
import { findForbiddenUrls, guardKind } from '../../scripts/lib/url-guard.mjs';

describe('guardKind', () => {
  it('scans documents, metadata and RSC payloads fully, scripts for URLs only', () => {
    for (const path of ['pl/index.html', 'sitemap.xml', 'robots.txt', 'pl/__next._full.txt']) {
      expect(guardKind(path)).toBe('document');
    }
    expect(guardKind('manifest.webmanifest')).toBe('document');
    expect(guardKind('data.json')).toBe('document');
    expect(guardKind('_next/static/chunks/0cz1.js')).toBe('script');
    expect(guardKind('og/pl.png')).toBeNull();
    expect(guardKind('_next/static/media/font.woff2')).toBeNull();
  });
});

describe('findForbiddenUrls', () => {
  it('flags localhost URLs and placeholders in documents', () => {
    const html =
      '<link rel="canonical" href="http://localhost:4173/kabaninno/pl/"/>' +
      '<a href="https://t.me/[TELEGRAM_USERNAME]">x</a> [ДОМЕН] //127.0.0.1:3000';
    const labels = findForbiddenUrls('pl/index.html', html).map((hit) => hit.label);
    expect(labels).toEqual(['//localhost', '//127.0.0.1', '[ДОМЕН]', '[TELEGRAM_USERNAME]']);
    expect(
      findForbiddenUrls('robots.txt', 'Sitemap: http://localhost:3000/sitemap.xml'),
    ).toHaveLength(1);
  });

  it('passes real and reserved URLs', () => {
    const html =
      '<link rel="canonical" href="https://owner.github.io/kabaninno/pl/"/>' +
      '<meta property="og:image" content="https://kabaninno.invalid/kabaninno/og/pl.png"/>' +
      '<a href="https://t.me/wa1demarr">x</a>';
    expect(findForbiddenUrls('pl/index.html', html)).toEqual([]);
  });

  it('ignores bare "localhost" literals in Next.js chunks, but not localhost URLs', () => {
    const runtime = 'if(a=s.parseHost(l))return a;if("localhost"===s.host&&(s.host=""),e)return;';
    expect(findForbiddenUrls('_next/static/chunks/a.js', runtime)).toEqual([]);
    expect(
      findForbiddenUrls('_next/static/chunks/a.js', 'fetch("http://localhost:3000/api")'),
    ).toHaveLength(1);
    // Placeholders in scripts are not URL-shaped, so they are left to the documents.
    expect(findForbiddenUrls('_next/static/chunks/a.js', 'x="[ДОМЕН]"')).toEqual([]);
  });

  it('accepts extra document rules and gives an excerpt', () => {
    const [hit] = findForbiddenUrls('pl/index.html', 'href="https://kabaninno.invalid/pl/"', [
      { label: '.invalid', pattern: /kabaninno\.invalid/ },
    ]);
    expect(hit).toMatchObject({ path: 'pl/index.html', label: '.invalid' });
    expect(hit!.excerpt).toContain('kabaninno.invalid');
  });
});
