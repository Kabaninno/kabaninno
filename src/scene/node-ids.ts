import type { SceneTarget } from '@/lib/route-state';

/**
 * Highlight ids shared by the 3D scene and the HTML navigation through
 * `useSceneStore().highlighted`. Three-free: safe to import from HUD code.
 */
export const sceneNodeId = {
  category: (categoryId: string) => `category:${categoryId}`,
  service: (categoryId: string, serviceSlug: string) => `service:${categoryId}/${serviceSlug}`,
  project: (projectSlug: string) => `project:${projectSlug}`,
  portfolio: 'portfolio',
  configurator: 'configurator',
} as const;

/**
 * Maps any highlight id to the universe node it lights up: a service lights its
 * category node, a project lights the portfolio cluster.
 */
export function universeKeyForHighlight(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.startsWith('service:')) {
    const categoryId = id.slice('service:'.length).split('/')[0];
    return categoryId ? sceneNodeId.category(categoryId) : null;
  }
  if (id.startsWith('project:')) return sceneNodeId.portfolio;
  return id;
}

/** Universe node the camera is focused on for a given URL target (null = overview). */
export function focusKeyForTarget(target: SceneTarget): string | null {
  switch (target.mode) {
    case 'system':
    case 'planet':
      return sceneNodeId.category(target.category);
    case 'portfolio':
    case 'project':
      return sceneNodeId.portfolio;
    case 'configurator':
      return sceneNodeId.configurator;
    default:
      return null;
  }
}
