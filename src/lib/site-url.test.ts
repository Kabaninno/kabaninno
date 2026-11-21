import { describe, expect, it } from 'vitest';
import { absoluteUrl, resolveSiteUrl } from './site-url';

describe('resolveSiteUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes', () => {
    expect(resolveSiteUrl('https://user.github.io/repo/', '[DOMAIN]', '/repo')).toBe(
      'https://user.github.io/repo',
    );
    expect(resolveSiteUrl('https://example.com', 'other.com', '')).toBe('https://example.com');
  });

  it('drops query strings and hashes from the env URL', () => {
    expect(resolveSiteUrl('https://example.com/base/?x=1#y', 'x', '')).toBe(
      'https://example.com/base',
    );
  });

  it('falls back to the configured domain when the env URL is invalid or missing', () => {
    expect(resolveSiteUrl('not a url', 'studio.example', '')).toBe('https://studio.example');
    expect(resolveSiteUrl(undefined, 'studio.example', '')).toBe('https://studio.example');
    expect(resolveSiteUrl('', 'studio.example', '')).toBe('https://studio.example');
  });

  it('appends the base path to the configured domain', () => {
    expect(resolveSiteUrl(undefined, 'studio.example', '/kabaninno')).toBe(
      'https://studio.example/kabaninno',
    );
  });

  it.each(['[ДОМЕН]', '[DOMAIN]', 'localhost', 'no-tld', ''])(
    'ignores the placeholder/invalid domain %j and uses localhost',
    (domain) => {
      expect(resolveSiteUrl(undefined, domain, '')).toBe('http://localhost:3000');
      expect(resolveSiteUrl(undefined, domain, '/kabaninno')).toBe(
        'http://localhost:3000/kabaninno',
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
