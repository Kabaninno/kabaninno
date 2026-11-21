import { getCategories, getProjects } from '~/content';
import { paths } from './routes';

/**
 * Every locale-less page path of the site, derived from content data
 * (categories, services, visible projects). Used by the sitemap.
 */
export function getAllSitePaths(showDrafts?: boolean): string[] {
  const categories = getCategories();
  return [
    paths.home(),
    ...categories.map((category) => paths.category(category.id)),
    ...categories.flatMap((category) =>
      category.services.map((service) => paths.service(category.id, service.slug)),
    ),
    paths.portfolio(),
    ...getProjects(showDrafts).map((project) => paths.project(project.slug)),
    paths.configurator(),
  ];
}
