import { categoriesData } from './categories';
import { projectsData } from './projects';
import {
  categoriesSchema,
  projectsSchema,
  type Category,
  type Project,
  type Service,
} from './schema';

export * from './schema';

/* Validated once at module load: invalid content fails the build and tests. */
const categories: readonly Category[] = [...categoriesSchema.parse(categoriesData)].sort(
  (a, b) => a.order - b.order,
);
const allProjects: readonly Project[] = projectsSchema.parse(projectsData);

assertProjectReferences(allProjects, categories);

/**
 * Draft cases are shown in development (`next dev`, tests) and in builds made
 * with `SHOW_DRAFTS=true`. Production builds only include published cases.
 */
export function shouldShowDrafts(
  env: { NODE_ENV?: string; SHOW_DRAFTS?: string } = process.env,
): boolean {
  return env.NODE_ENV !== 'production' || env.SHOW_DRAFTS === 'true';
}

export function getCategories(): readonly Category[] {
  return categories;
}

export function getCategory(id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function getService(categoryId: string, slug: string): Service | undefined {
  return getCategory(categoryId)?.services.find((service) => service.slug === slug);
}

/** All projects regardless of status (for validation and tooling). */
export function getAllProjects(): readonly Project[] {
  return allProjects;
}

/** Projects visible in the current build. */
export function getProjects(showDrafts: boolean = shouldShowDrafts()): readonly Project[] {
  return showDrafts ? allProjects : allProjects.filter((project) => project.status === 'published');
}

export function getProject(slug: string, showDrafts?: boolean): Project | undefined {
  return getProjects(showDrafts).find((project) => project.slug === slug);
}

export function getProjectsForService(
  categoryId: string,
  serviceSlug: string,
  showDrafts?: boolean,
): readonly Project[] {
  const ref = `${categoryId}/${serviceSlug}`;
  return getProjects(showDrafts).filter((project) => project.services.includes(ref));
}

function assertProjectReferences(
  projects: readonly Project[],
  knownCategories: readonly Category[],
): void {
  const categoryIds = new Set(knownCategories.map((category) => category.id));
  const serviceRefs = new Set(
    knownCategories.flatMap((category) =>
      category.services.map((service) => `${category.id}/${service.slug}`),
    ),
  );
  const slugs = new Set<string>();
  for (const project of projects) {
    if (slugs.has(project.slug)) throw new Error(`Duplicate project slug "${project.slug}"`);
    slugs.add(project.slug);
    for (const id of project.categories) {
      if (!categoryIds.has(id)) {
        throw new Error(`Project "${project.slug}" references unknown category "${id}"`);
      }
    }
    for (const ref of project.services) {
      if (!serviceRefs.has(ref)) {
        throw new Error(`Project "${project.slug}" references unknown service "${ref}"`);
      }
    }
  }
}
