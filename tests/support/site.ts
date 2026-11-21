import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAllProjects, getCategories } from '~/content';
import enContent from '~/messages/en/content.json';
import enUi from '~/messages/en/ui.json';
import plContent from '~/messages/pl/content.json';
import plUi from '~/messages/pl/ui.json';
import ukContent from '~/messages/uk/content.json';
import ukUi from '~/messages/uk/ui.json';
import { paths } from '@/lib/routes';
import { OUT_DIR } from './env';

/**
 * Site data for tests, straight from the content layer and the dictionaries
 * (never duplicated in specs): categories, services, texts per locale.
 */

export const LOCALES = ['pl', 'en', 'uk'] as const;
export type TestLocale = (typeof LOCALES)[number];

export const ui = { pl: plUi, en: enUi, uk: ukUi } as const;
const content = { pl: plContent, en: enContent, uk: ukContent } as const;

export interface TestService {
  slug: string;
  path: string;
}

export interface TestCategory {
  id: string;
  path: string;
  services: TestService[];
}

export const categories: TestCategory[] = getCategories().map((category) => ({
  id: category.id,
  path: paths.category(category.id),
  services: category.services.map((service) => ({
    slug: service.slug,
    path: paths.service(category.id, service.slug),
  })),
}));

/** Projects that actually have a page in out/ (production builds hide drafts, D12). */
export function builtProjects(): { slug: string; path: string }[] {
  return getAllProjects()
    .filter((project) => existsSync(join(OUT_DIR, 'pl', 'portfolio', project.slug, 'index.html')))
    .map((project) => ({ slug: project.slug, path: paths.project(project.slug) }));
}

type ContentTexts = typeof plContent;
type CategoryKey = keyof ContentTexts['categories'];

export function categoryName(locale: TestLocale, id: string): string {
  return content[locale].categories[id as CategoryKey].name;
}

export function serviceTitle(locale: TestLocale, categoryId: string, slug: string): string {
  const services = content[locale].services as Record<string, Record<string, { title: string }>>;
  const text = services[categoryId]?.[slug];
  if (!text) throw new Error(`No text for service ${categoryId}/${slug} (${locale})`);
  return text.title;
}

export function projectTitle(locale: TestLocale, slug: string): string {
  const projects = content[locale].projects as Record<string, { title: string }>;
  const text = projects[slug];
  if (!text) throw new Error(`No text for project ${slug} (${locale})`);
  return text.title;
}

/** `/pl` + locale-less path. */
export function localized(locale: TestLocale, path: string): string {
  return `/${locale}${path}`;
}

export { paths };
