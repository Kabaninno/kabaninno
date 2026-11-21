/**
 * Debug hook contract (DECISIONS D19). With `?debug=1` in the URL the scene
 * publishes render statistics on `window.__sceneStats` (~every 500 ms) so
 * reviewers can compare performance in a headless browser.
 */
export interface SceneStats {
  /** Draw calls in the last frame (all render passes). */
  calls: number;
  /** Triangles in the last frame (all render passes). */
  triangles: number;
  /** Compiled shader programs alive. */
  programs: number;
  /** Geometries alive on the GPU. */
  geometries: number;
  /** Textures alive on the GPU. */
  textures: number;
  /** Average frame time over the last publish interval, ms. */
  frameMs: number;
}

declare global {
  interface Window {
    __sceneStats?: SceneStats;
  }
}

export const SCENE_STATS_INTERVAL_MS = 500;

export function isSceneDebugEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}
