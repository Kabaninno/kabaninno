import { describe, expect, it } from 'vitest';
import {
  IFRAME_SANDBOX,
  demoHost,
  emphasisForFilter,
  fillTemplate,
  filterOptions,
  filterProjects,
  iframeDemoAttributes,
  parseCategoryFilter,
  projectSiblings,
} from './portfolio';

const projects = [
  { slug: 'bakery', categories: ['telegram', 'web'] },
  { slug: 'clinic', categories: ['crm', 'automation'] },
  { slug: 'logistics', categories: ['ai', 'automation'] },
];
const order = ['web', 'crm', 'automation', 'ai', 'telegram', 'unused'];

describe('category filter', () => {
  it('offers only categories with projects, in content order, with counts', () => {
    expect(filterOptions(projects, order)).toEqual([
      { id: 'web', count: 1 },
      { id: 'crm', count: 1 },
      { id: 'automation', count: 2 },
      { id: 'ai', count: 1 },
      { id: 'telegram', count: 1 },
    ]);
    expect(filterOptions([], order)).toEqual([]);
  });

  it('accepts only known category ids from the query', () => {
    expect(parseCategoryFilter('automation', order)).toBe('automation');
    expect(parseCategoryFilter('nope', order)).toBeNull();
    expect(parseCategoryFilter('', order)).toBeNull();
    expect(parseCategoryFilter(null, order)).toBeNull();
  });

  it('filters projects by category, or keeps all without a filter', () => {
    expect(filterProjects(projects, 'automation').map((project) => project.slug)).toEqual([
      'clinic',
      'logistics',
    ]);
    expect(filterProjects(projects, null)).toHaveLength(3);
    expect(filterProjects(projects, null)).not.toBe(projects);
  });
});

describe('emphasisForFilter (D87)', () => {
  it('emphasises the filtered projects, nothing without a filter', () => {
    expect(emphasisForFilter(projects, 'automation')).toEqual([
      'project:clinic',
      'project:logistics',
    ]);
    expect(emphasisForFilter(projects, null)).toEqual([]);
  });
});

describe('projectSiblings', () => {
  const slugs = projects.map((project) => project.slug);

  it('wraps around the list', () => {
    expect(projectSiblings(slugs, 'bakery')).toEqual({ previous: 'logistics', next: 'clinic' });
    expect(projectSiblings(slugs, 'logistics')).toEqual({ previous: 'clinic', next: 'bakery' });
  });

  it('has no siblings for a single case or an unknown slug', () => {
    expect(projectSiblings(['bakery'], 'bakery')).toBeNull();
    expect(projectSiblings(slugs, 'nope')).toBeNull();
  });
});

describe('iframe demo', () => {
  it('lazy-loads in a sandbox without referrer, at the stored aspect ratio', () => {
    expect(iframeDemoAttributes({ url: 'https://example.com/', aspectRatio: 1.6 }, 'Demo')).toEqual(
      {
        src: 'https://example.com/',
        title: 'Demo',
        loading: 'lazy',
        sandbox: IFRAME_SANDBOX,
        referrerPolicy: 'no-referrer',
        allow: 'fullscreen',
        style: { aspectRatio: '1.6' },
      },
    );
    expect(IFRAME_SANDBOX).not.toMatch(/allow-top-navigation|allow-popups/);
  });

  it('shows the host on the facade', () => {
    expect(demoHost('https://example.com/app?x=1')).toBe('example.com');
    expect(demoHost('not a url')).toBe('not a url');
  });
});

describe('fillTemplate', () => {
  it('fills known tokens and leaves unknown ones', () => {
    expect(fillTemplate('Zarezerwowano: {day}, {time}', { day: 'pon.', time: '14:00' })).toBe(
      'Zarezerwowano: pon., 14:00',
    );
    expect(fillTemplate('{a} {b}', { a: 1 })).toBe('1 {b}');
  });
});
