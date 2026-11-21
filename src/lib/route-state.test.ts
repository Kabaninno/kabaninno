import { describe, expect, it } from 'vitest';
import {
  parentSceneState,
  routeToSceneState,
  sceneStateToPath,
  type SceneTarget,
} from './route-state';

describe('routeToSceneState', () => {
  it.each<[string, SceneTarget]>([
    ['/', { mode: 'universe' }],
    ['', { mode: 'universe' }],
    ['/services', { mode: 'universe' }],
    ['/services/', { mode: 'universe' }],
    ['/services/web', { mode: 'system', category: 'web' }],
    ['/services/web/', { mode: 'system', category: 'web' }],
    ['/services/web/landing-pages', { mode: 'planet', category: 'web', service: 'landing-pages' }],
    ['/services/web/landing-pages/', { mode: 'planet', category: 'web', service: 'landing-pages' }],
    ['/portfolio', { mode: 'portfolio' }],
    ['/portfolio/', { mode: 'portfolio' }],
    ['/portfolio/bakery-telegram-orders/', { mode: 'project', project: 'bakery-telegram-orders' }],
    ['/configurator', { mode: 'configurator' }],
    ['/configurator/', { mode: 'configurator' }],
  ])('maps locale-less %j', (pathname, expected) => {
    expect(routeToSceneState(pathname)).toEqual(expected);
  });

  it.each(['pl', 'en', 'uk'])('strips the "%s" locale prefix', (locale) => {
    expect(routeToSceneState(`/${locale}`)).toEqual({ mode: 'universe' });
    expect(routeToSceneState(`/${locale}/`)).toEqual({ mode: 'universe' });
    expect(routeToSceneState(`/${locale}/services/crm/`)).toEqual({
      mode: 'system',
      category: 'crm',
    });
    expect(routeToSceneState(`/${locale}/services/ai/ai-analytics`)).toEqual({
      mode: 'planet',
      category: 'ai',
      service: 'ai-analytics',
    });
    expect(routeToSceneState(`/${locale}/configurator/`)).toEqual({ mode: 'configurator' });
  });

  it('only strips a known locale', () => {
    expect(routeToSceneState('/de/services/web/')).toEqual({ mode: 'unknown' });
  });

  it('ignores query strings and hashes', () => {
    expect(routeToSceneState('/pl/configurator/?add=web/landing-pages')).toEqual({
      mode: 'configurator',
    });
    expect(routeToSceneState('/en/services/web/#top')).toEqual({ mode: 'system', category: 'web' });
  });

  it('decodes percent-encoded segments', () => {
    expect(routeToSceneState('/pl/portfolio/case%2Done/')).toEqual({
      mode: 'project',
      project: 'case-one',
    });
  });

  it('keeps malformed percent-escapes raw instead of throwing', () => {
    expect(() => routeToSceneState('/pl/services/%E0/')).not.toThrow();
    expect(routeToSceneState('/pl/services/%E0/')).toEqual({ mode: 'system', category: '%E0' });
    expect(routeToSceneState('/uk/portfolio/case%/')).toEqual({
      mode: 'project',
      project: 'case%',
    });
    expect(routeToSceneState('/%E0%A4%A/')).toEqual({ mode: 'unknown' });
  });

  it.each([
    '/unknown',
    '/pl/unknown/',
    '/services/web/landing-pages/extra',
    '/portfolio/a/b',
    '/configurator/step-2',
    '/pl/pl/',
  ])('returns "unknown" for %j', (pathname) => {
    expect(routeToSceneState(pathname)).toEqual({ mode: 'unknown' });
  });
});

describe('sceneStateToPath', () => {
  it.each<[SceneTarget, string]>([
    [{ mode: 'universe' }, '/'],
    [{ mode: 'unknown' }, '/'],
    [{ mode: 'system', category: 'web' }, '/services/web/'],
    [{ mode: 'planet', category: 'web', service: 'web-apps' }, '/services/web/web-apps/'],
    [{ mode: 'portfolio' }, '/portfolio/'],
    [{ mode: 'project', project: 'x' }, '/portfolio/x/'],
    [{ mode: 'configurator' }, '/configurator/'],
  ])('builds the path for %j', (target, expected) => {
    expect(sceneStateToPath(target)).toBe(expected);
  });

  it.each<SceneTarget>([
    { mode: 'universe' },
    { mode: 'system', category: 'automation' },
    { mode: 'planet', category: 'telegram', service: 'mini-apps' },
    { mode: 'portfolio' },
    { mode: 'project', project: 'dental-clinic-crm' },
    { mode: 'configurator' },
  ])('round-trips %j (with and without a locale prefix)', (target) => {
    const path = sceneStateToPath(target);
    expect(path.endsWith('/')).toBe(true);
    expect(routeToSceneState(path)).toEqual(target);
    expect(routeToSceneState(`/uk${path}`)).toEqual(target);
  });
});

describe('parentSceneState', () => {
  it('goes from a planet to its system', () => {
    expect(parentSceneState({ mode: 'planet', category: 'crm', service: 'custom-crm' })).toEqual({
      mode: 'system',
      category: 'crm',
    });
  });

  it('goes from a project to the portfolio', () => {
    expect(parentSceneState({ mode: 'project', project: 'x' })).toEqual({ mode: 'portfolio' });
  });

  it.each<SceneTarget>([
    { mode: 'system', category: 'web' },
    { mode: 'portfolio' },
    { mode: 'configurator' },
    { mode: 'universe' },
    { mode: 'unknown' },
  ])('goes to the universe from %j', (target) => {
    expect(parentSceneState(target)).toEqual({ mode: 'universe' });
  });
});
