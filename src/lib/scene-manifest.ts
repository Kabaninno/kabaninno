import { getCategories, getProjects } from '~/content';
import type { Locale } from '@/i18n/routing';
import type { SceneManifest } from '@/scene/types';
import { getCategoryText, getProjectText, getServiceText } from './content-text';

/** Server-only: builds the per-locale scene manifest passed to the canvas. */
export function buildSceneManifest(locale: Locale): SceneManifest {
  return {
    categories: getCategories().map((category) => ({
      id: category.id,
      label: getCategoryText(locale, category.id).name,
      dna: category.dna,
      services: category.services.map((service) => ({
        slug: service.slug,
        label: getServiceText(locale, category.id, service.slug).title,
        planet: service.planet,
      })),
    })),
    projects: getProjects().map((project) => ({
      slug: project.slug,
      label: getProjectText(locale, project.slug).title,
      categories: [...project.categories],
    })),
  };
}
