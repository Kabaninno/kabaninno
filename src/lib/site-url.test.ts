import { describe, expect, it } from 'vitest';
import { SITE_URL_MISSING, absoluteUrl, resolveSiteUrl } from './site-url';

describe('resolveSiteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes', () => {
    expect(resolveSiteUrl('https://user.github.io/repo/', '[DOMAIN]', '/repo', 'production')).toBe(
      'https://user.github.io/repo',
    );
    expect(resolveSiteUrl('https://example.com', 'other.com', '', 'production')).toBe(
      'https://example.com',
    );
  });

  it('drops query strings and hashes from the env URL', () => {
    expect(resolveSiteUrl('https://example.com/base/?x=1#y', 'x', '', 'production')).toBe(
      'https://example.com/base',
    );
  });

  it('ignores env values that are not http(s) URLs', () => {
    expect(resolveSiteUrl('ftp://example.com', 'studio.example', '', 'production')).toBe(
      'https://studio.example',
    );
    expect(resolveSiteUrl('not a url', 'studio.example', '', 'production')).toBe(
      'https://studio.example',
    );
  });

  it('falls back to a real configured domain, with the base path', () => {
    expect(resolveSiteUrl(undefined, 'studio.example', '', 'production')).toBe(
      'https://studio.example',
    );
    expect(resolveSiteUrl('', 'studio.example', '/kabaninno', 'production')).toBe(
      'https://studio.example/kabaninno',
    );
  });

  it.each(['[ДОМЕН]', '[DOMAIN]', 'localhost', 'no-tld', ''])(
    'uses localhost only outside production (placeholder/invalid domain %j)',
    (domain) => {
      expect(resolveSiteUrl(undefined, domain, '', 'development')).toBe('http://localhost:3000');
      expect(resolveSiteUrl(undefined, domain, '/kabaninno', 'test')).toBe(
        'http://localhost:3000/kabaninno',
      );
      expect(resolveSiteUrl(undefined, domain, '/kabaninno', undefined)).toBe(
        'http://localhost:3000/kabaninno',
      );
    },
  );

  it.each(['[ДОМЕН]', 'localhost', ''])(
    'fails a production build without a public URL (domain %j)',
    (domain) => {
      expect(() => resolveSiteUrl(undefined, domain, '/kabaninno', 'production')).toThrow(
        SITE_URL_MISSING,
      );
      expect(() => resolveSiteUrl('not a url', domain, '', 'production')).toThrow(
        /NEXT_PUBLIC_SITE_URL/,
      );
    },
  );
});

describe('absoluteUrl', () => {
  it('joins the site URL and a path', () => {
    expect(absoluteUrl('/pl/', 'https://example.com')).toBe('https://example.com/pl/');
    expect(absoluteUrl('sitemap.xml', 'https://user.github.io/repo')).toBe(
      'https://user.github.io/repo/sitemap.xml',
    );
  });
});
