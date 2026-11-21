let cached: boolean | null = null;

/** True when the browser can create a WebGL2 (preferred) or WebGL context. */
export function isWebGLAvailable(): boolean {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    cached = context !== null;
    // Release the probe context right away (mobile browsers cap live contexts).
    if (context && 'getExtension' in context) {
      (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    cached = false;
  }
  return cached;
}
