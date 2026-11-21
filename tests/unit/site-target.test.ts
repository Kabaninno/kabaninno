import { describe, expect, it } from 'vitest';
import {
  INVALID_SITE_ORIGIN,
  pagesTargetFor,
  parseGithubRepository,
  resolvePreviewTarget,
} from '../../scripts/lib/site-target.mjs';

describe('parseGithubRepository', () => {
  it.each([
    ['Owner/kabaninno', 'Owner', 'kabaninno'],
    ['https://github.com/Owner/kabaninno.git', 'Owner', 'kabaninno'],
    ['https://github.com/Owner/kabaninno', 'Owner', 'kabaninno'],
    ['https://token@github.com/Owner/kabaninno.git', 'Owner', 'kabaninno'],
    ['git@github.com:Owner/kabaninno.git', 'Owner', 'kabaninno'],
    ['ssh://git@github.com/Owner/my.site.git', 'Owner', 'my.site'],
  ])('reads %s', (input, owner, repo) => {
    expect(parseGithubRepository(input)).toEqual({ owner, repo });
  });

  it.each(['', undefined, null, 'https://gitlab.com/owner/repo.git', 'just-a-name'])(
    'rejects %j',
    (input) => {
      expect(parseGithubRepository(input)).toBeNull();
    },
  );
});

describe('pagesTargetFor (what actions/configure-pages reports)', () => {
  it('is a project site under /<repo>, owner lowercased', () => {
    expect(pagesTargetFor({ owner: 'Owner', repo: 'kabaninno' })).toEqual({
      origin: 'https://owner.github.io',
      basePath: '/kabaninno',
    });
  });

  it('is a user site without a base path for <owner>.github.io', () => {
    expect(pagesTargetFor({ owner: 'Owner', repo: 'owner.github.io' })).toEqual({
      origin: 'https://owner.github.io',
      basePath: '',
    });
  });
});

describe('resolvePreviewTarget', () => {
  it('derives the Pages URL from GITHUB_REPOSITORY, then from the git remote', () => {
    expect(resolvePreviewTarget({ GITHUB_REPOSITORY: 'Owner/site' }, null)).toMatchObject({
      basePath: '/site',
      siteUrl: 'https://owner.github.io/site',
      source: 'github:Owner/site',
    });
    expect(resolvePreviewTarget({}, 'git@github.com:Owner/kabaninno.git')).toMatchObject({
      basePath: '/kabaninno',
      siteUrl: 'https://owner.github.io/kabaninno',
    });
  });

  it('lets explicit env values win', () => {
    expect(
      resolvePreviewTarget(
        { NEXT_PUBLIC_SITE_URL: 'https://example.com/x/', PREVIEW_BASE_PATH: '/x' },
        'git@github.com:Owner/kabaninno.git',
      ),
    ).toEqual({ basePath: '/x', siteUrl: 'https://example.com/x', source: 'env' });
    expect(
      resolvePreviewTarget({ PREVIEW_SITE_URL: 'https://studio.example' }, null),
    ).toMatchObject({ siteUrl: 'https://studio.example', basePath: '/kabaninno' });
  });

  it('keeps the derived origin with an overridden base path', () => {
    expect(
      resolvePreviewTarget({ PREVIEW_BASE_PATH: 'preview' }, 'https://github.com/Owner/site'),
    ).toMatchObject({ basePath: '/preview', siteUrl: 'https://owner.github.io/preview' });
    expect(resolvePreviewTarget({ NEXT_PUBLIC_BASE_PATH: '' }, null)).toMatchObject({
      basePath: '',
      siteUrl: INVALID_SITE_ORIGIN,
    });
  });

  it('falls back to the reserved .invalid origin with a warning, never localhost', () => {
    const target = resolvePreviewTarget({}, null);
    expect(target).toMatchObject({
      basePath: '/kabaninno',
      siteUrl: 'https://kabaninno.invalid/kabaninno',
      source: 'fallback',
    });
    expect(target.warning).toMatch(/No public URL/);
    expect(resolvePreviewTarget({ NEXT_PUBLIC_SITE_URL: 'not a url' }, null).siteUrl).not.toMatch(
      /localhost/,
    );
  });
});
