import { WebGLRenderer, type WebGLRendererParameters } from 'three';

/**
 * Context attributes of the scene. The canvas is opaque (D48); stencil is
 * unused; the bloom composer does its own multisampling.
 */
export const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: true,
  depth: true,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
};

/** R3F's default renderer parameters (its `DefaultGLProps`, not exported). */
type FactoryDefaults = Omit<WebGLRendererParameters, 'canvas'> & { canvas: unknown };

/**
 * R3F renderer factory (`<Canvas gl={...}>`). Creates the scene's only WebGL
 * context on R3F's own canvas (SceneRoot no longer probes, perf P-01). If
 * the context cannot be created, three.js would log an error and throw into
 * React (an error-boundary log = a console error), so instead the factory
 * reports `onUnavailable` (SceneRoot unmounts the scene and the page carries
 * on without 3D) and returns a promise that never settles: R3F simply keeps
 * waiting until it is unmounted.
 */
export function createSceneRenderer(
  defaults: FactoryDefaults,
  onUnavailable: () => void,
): Promise<WebGLRenderer> {
  // R3F's <Canvas> always hands over its DOM canvas.
  const canvas = defaults.canvas as HTMLCanvasElement;
  let context: WebGL2RenderingContext | null = null;
  try {
    context = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES) as WebGL2RenderingContext | null;
  } catch {
    context = null;
  }
  if (!context) {
    queueMicrotask(onUnavailable);
    return new Promise<WebGLRenderer>(() => {});
  }
  return Promise.resolve(
    new WebGLRenderer({
      ...defaults,
      ...CONTEXT_ATTRIBUTES,
      canvas,
      context,
    }),
  );
}
