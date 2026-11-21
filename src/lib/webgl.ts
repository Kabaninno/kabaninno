/**
 * Cheap WebGL capability check for SceneRoot (D55): the browser exposes the
 * WebGL 2 API (three.js r163+ requires WebGL 2). No context is created here —
 * the old throw-away probe context cost ~378 ms of hydration at 4× CPU
 * (perf P-01). A real context can still fail (blocklisted GPU, policy, lost
 * device); the scene creates exactly one context, its own, and falls back to
 * "no scene" silently when that fails (see `createSceneRenderer`).
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof (window as Window & { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext !==
    'undefined'
  );
}
