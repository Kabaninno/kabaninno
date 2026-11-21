import type { CategoryDna, Planet } from '~/content/schema';

/**
 * Serializable data the client-side scene needs. Built on the server (per
 * locale) and passed to the scene as a prop, so the browser never downloads
 * full content dictionaries or draft-only data.
 */
export interface SceneManifest {
  categories: SceneCategory[];
  projects: SceneProject[];
}

export interface SceneCategory {
  id: string;
  label: string;
  dna: CategoryDna;
  services: SceneService[];
}

export interface SceneService {
  slug: string;
  label: string;
  planet: Planet;
}

export interface SceneProject {
  slug: string;
  label: string;
  categories: string[];
}

export type Vec3 = [number, number, number];
