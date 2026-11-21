import { describe, expect, it } from 'vitest';
import {
  categoriesSchema,
  contentTextsSchema,
  getAllProjects,
  getCategories,
  getCategory,
  getProject,
  getProjects,
  getProjectsForService,
  getService,
  projectsSchema,
  shouldShowDrafts,
} from '~/content';
import { categoriesData } from '~/content/categories';
import { projectsData } from '~/content/projects';
import enContent from '~/messages/en/content.json';
import enUi from '~/messages/en/ui.json';
import plContent from '~/messages/pl/content.json';
import plUi from '~/messages/pl/ui.json';
import ukContent from '~/messages/uk/content.json';
import ukUi from '~/messages/uk/ui.json';
import { locales } from '@/i18n/routing';
import { getAllSitePaths } from '@/lib/site-paths';

const ui = { pl: plUi, en: enUi, uk: ukUi } as const;
const content = { pl: plContent, en: enContent, uk: ukContent } as const;

/** Every key path of a JSON tree; arrays are leaves (their length is checked separately). */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

/** Every array in a JSON tree with its path and length. */
function arrayLengths(value: unknown, prefix = ''): Record<string, number> {
  if (Array.isArray(value)) return { [prefix]: value.length };
  if (value === null || typeof value !== 'object') return {};
  return Object.assign(
    {},
    ...Object.entries(value as Record<string, unknown>).map(([key, child]) =>
      arrayLengths(child, prefix ? `${prefix}.${key}` : key),
    ),
  );
}

/** Leaf strings with their key paths. */
function leaves(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** ICU argument names used by a message, e.g. "{min}–{max, plural, …}" → ["max", "min"]. */
function icuArguments(message: string): string[] {
  return [
    ...new Set([...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map((m) => m[1]!)),
  ].sort();
}

describe('content data', () => {
  it('parses with the zod schemas', () => {
    expect(() => categoriesSchema.parse(categoriesData)).not.toThrow();
    expect(() => projectsSchema.parse(projectsData)).not.toThrow();
  });

  it('has 5 categories with 3-5 services each, sorted by order', () => {
    const categories = getCategories();
    expect(categories).toHaveLength(5);
    expect(categories.map((category) => category.order)).toEqual(
      [...categories.map((category) => category.order)].sort((a, b) => a - b),
    );
    for (const category of categories) {
      expect(category.services.length).toBeGreaterThanOrEqual(3);
      expect(category.services.length).toBeLessThanOrEqual(5);
    }
  });

  it('looks up categories, services and projects', () => {
    expect(getCategory('web')?.id).toBe('web');
    expect(getCategory('nope')).toBeUndefined();
    expect(getService('web', 'landing-pages')?.slug).toBe('landing-pages');
    expect(getService('web', 'nope')).toBeUndefined();
    expect(getService('nope', 'landing-pages')).toBeUndefined();
  });

  it('has valid project references', () => {
    for (const project of getAllProjects()) {
      for (const id of project.categories)
        expect(getCategory(id), `${project.slug} → ${id}`).toBeDefined();
      for (const ref of project.services) {
        const [categoryId, slug] = ref.split('/') as [string, string];
        expect(getService(categoryId, slug), `${project.slug} → ${ref}`).toBeDefined();
      }
    }
  });
});

describe('draft visibility', () => {
  it('follows shouldShowDrafts rules', () => {
    expect(shouldShowDrafts({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldShowDrafts({ NODE_ENV: 'test' })).toBe(true);
    expect(shouldShowDrafts({})).toBe(true);
    expect(shouldShowDrafts({ NODE_ENV: 'production' })).toBe(false);
    expect(shouldShowDrafts({ NODE_ENV: 'production', SHOW_DRAFTS: 'false' })).toBe(false);
    expect(shouldShowDrafts({ NODE_ENV: 'production', SHOW_DRAFTS: '1' })).toBe(false);
    expect(shouldShowDrafts({ NODE_ENV: 'production', SHOW_DRAFTS: 'true' })).toBe(true);
  });

  it('excludes drafts when drafts are hidden', () => {
    const visible = getProjects(false);
    expect(visible.every((project) => project.status === 'published')).toBe(true);
    expect(getProjects(true)).toHaveLength(getAllProjects().length);
    const draft = getAllProjects().find((project) => project.status === 'draft');
    if (draft) {
      expect(getProject(draft.slug, false)).toBeUndefined();
      expect(getProject(draft.slug, true)?.slug).toBe(draft.slug);
      for (const ref of draft.services) {
        const [categoryId, slug] = ref.split('/') as [string, string];
        expect(getProjectsForService(categoryId, slug, false)).not.toContainEqual(draft);
        expect(getProjectsForService(categoryId, slug, true)).toContainEqual(draft);
      }
    }
  });
});

describe('content texts (messages/<locale>/content.json)', () => {
  it.each(locales)('%s: validates and covers every category, service and project', (locale) => {
    const texts = contentTextsSchema.parse(content[locale]);
    for (const category of getCategories()) {
      expect(texts.categories[category.id], `categories.${category.id}`).toBeDefined();
      for (const service of category.services) {
        expect(
          texts.services[category.id]?.[service.slug],
          `services.${category.id}.${service.slug}`,
        ).toBeDefined();
      }
    }
    for (const project of getAllProjects()) {
      expect(texts.projects[project.slug], `projects.${project.slug}`).toBeDefined();
    }
  });

  it.each(locales)('%s: has no texts for unknown entities', (locale) => {
    const texts = contentTextsSchema.parse(content[locale]);
    const categoryIds = getCategories()
      .map((category) => category.id)
      .sort();
    expect(Object.keys(texts.categories).sort()).toEqual(categoryIds);
    expect(Object.keys(texts.services).sort()).toEqual(categoryIds);
    for (const category of getCategories()) {
      expect(Object.keys(texts.services[category.id]!).sort()).toEqual(
        category.services.map((service) => service.slug).sort(),
      );
    }
    expect(Object.keys(texts.projects).sort()).toEqual(
      getAllProjects()
        .map((project) => project.slug)
        .sort(),
    );
  });
});

describe.each([
  ['ui.json', ui],
  ['content.json', content],
] as const)('locale parity: %s', (_name, dictionaries) => {
  const reference = dictionaries.pl;

  it.each(locales)('%s has the same key structure as pl', (locale) => {
    expect(keyPaths(dictionaries[locale])).toEqual(keyPaths(reference));
  });

  it.each(locales)('%s has parallel arrays of the same length as pl', (locale) => {
    expect(arrayLengths(dictionaries[locale])).toEqual(arrayLengths(reference));
  });

  it.each(locales)('%s uses the same ICU arguments as pl', (locale) => {
    const referenceArgs = Object.fromEntries(
      leaves(reference).map(([path, message]) => [path, icuArguments(message)]),
    );
    for (const [path, message] of leaves(dictionaries[locale])) {
      expect(icuArguments(message), path).toEqual(referenceArgs[path]);
    }
  });

  it.each(locales)('%s has no empty strings and no "_todo"-style keys (B2.4)', (locale) => {
    for (const [path, message] of leaves(dictionaries[locale])) {
      expect(message.trim(), path).not.toBe('');
    }
    for (const path of keyPaths(dictionaries[locale])) {
      expect(
        path.split('.').some((key) => key.startsWith('_')),
        path,
      ).toBe(false);
    }
  });
});

describe('site paths (sitemap source)', () => {
  it('lists every page once, with trailing slashes', () => {
    const services = getCategories().reduce((sum, category) => sum + category.services.length, 0);
    for (const showDrafts of [false, true]) {
      const all = getAllSitePaths(showDrafts);
      expect(new Set(all).size).toBe(all.length);
      expect(all.every((path) => path.startsWith('/') && path.endsWith('/'))).toBe(true);
      expect(all).toHaveLength(
        1 + getCategories().length + services + 1 + getProjects(showDrafts).length + 1,
      );
    }
    expect(getAllSitePaths(false)).not.toContain('/portfolio/bakery-telegram-orders/');
  });
});
