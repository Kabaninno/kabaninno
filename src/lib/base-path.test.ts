import { describe, expect, it } from 'vitest';
import { normalizeBasePath, withBasePath } from './base-path';

describe('normalizeBasePath', () => {
  it.each<[string | undefined | null, string]>([
    [undefined, ''],
    [null, ''],
    ['', ''],
    ['   ', ''],
    ['/', ''],
    ['repo', '/repo'],
    ['/repo', '/repo'],
    ['/repo/', '/repo'],
    ['/repo///', '/repo'],
    [' /repo ', '/repo'],
    ['/org/repo/', '/org/repo'],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizeBasePath(raw)).toBe(expected);
  });
});

describe('withBasePath', () => {
  it('prefixes root-relative paths', () => {
    expect(withBasePath('/pl/', '/kabaninno')).toBe('/kabaninno/pl/');
    expect(withBasePath('/textures/noise.png', '/kabaninno')).toBe('/kabaninno/textures/noise.png');
  });

  it('adds a leading slash when missing', () => {
    expect(withBasePath('icon.svg', '/kabaninno')).toBe('/kabaninno/icon.svg');
  });

  it('leaves paths untouched with an empty base path', () => {
    expect(withBasePath('/pl/', '')).toBe('/pl/');
    expect(withBasePath('/', '')).toBe('/');
  });

  it.each([
    'https://example.com/a',
    'http://x.y',
    'mailto:a@b.c',
    'tg://resolve',
    '//cdn.example.com/x',
  ])('does not touch absolute URL %j', (url) => {
    expect(withBasePath(url, '/kabaninno')).toBe(url);
  });
});
