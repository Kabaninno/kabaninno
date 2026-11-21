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

/**
 * Debug-only prewarm report (`?debug=1`): keys compiled so far, in order, with
 * the wall time of each compile (blocking when KHR_parallel_shader_compile is
 * missing, e.g. SwiftShader), and the key being compiled now.
 */
export interface ScenePrewarmReport {
  warm: Array<{ key: string; ms: number }>;
  current: string | null;
}

declare global {
  interface Window {
    __sceneStats?: SceneStats;
    __scenePrewarm?: ScenePrewarmReport;
  }
}

export const SCENE_STATS_INTERVAL_MS = 500;

export function isSceneDebugEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/**
 * `?debug=1&slowmo=N` (N in 1..20) runs camera flights, the reduced-motion
 * cut and the bloom flash N times slower, so reviewers can capture 4–6 frame
 * series of a flight in a slow headless browser (software GL). Ignored
 * without `debug=1`.
 */
export function debugSlowMotion(search: string): number {
  if (!isSceneDebugEnabled(search)) return 1;
  const value = Number(new URLSearchParams(search).get('slowmo'));
  return Number.isFinite(value) && value >= 1 ? Math.min(value, 20) : 1;
}
