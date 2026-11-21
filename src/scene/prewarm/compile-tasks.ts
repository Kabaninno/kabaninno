import type { Camera, Material, Object3D, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';
import type { CompileTask } from './compile-queue';

interface ProgramHandle {
  getUniforms(): unknown;
}

export function hasParallelCompile(gl: WebGLRenderer): boolean {
  return gl.extensions.has('KHR_parallel_shader_compile');
}

/**
 * Compile tasks for everything renderable under `root` (hidden roots too;
 * hidden descendants such as invisible hit zones are skipped, they are never
 * drawn), with the render-target state of the real render (`target`: the
 * composer's linear target when bloom is on — part of three's program key).
 *
 * - With KHR_parallel_shader_compile: one asynchronous `compileAsync` task.
 *   (Without the extension it would only warn and defer the stall.)
 * - Without it: one task per material — `compile()` issues the program, and
 *   `getUniforms()` forces the blocking link check now, inside the queue's
 *   idle slice, instead of on the first frame that draws the material.
 */
export function buildCompileTasks(
  gl: WebGLRenderer,
  root: Object3D,
  camera: Camera,
  scene: Scene,
  target: () => WebGLRenderTarget | null,
): CompileTask[] {
  const withTarget = <T>(run: () => T): T => {
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target());
    try {
      return run();
    } finally {
      gl.setRenderTarget(previous);
    }
  };
  if (hasParallelCompile(gl)) {
    return [() => withTarget(() => gl.compileAsync(root, camera, scene))];
  }
  const seen = new Set<Material>();
  const objects: Array<{ object: Object3D; materials: Material[] }> = [];
  const visit = (object: Object3D, isRoot: boolean) => {
    if (!isRoot && !object.visible) return;
    const renderable = object as Object3D & {
      isMesh?: boolean;
      isPoints?: boolean;
      isLine?: boolean;
      material?: Material | Material[];
    };
    if ((renderable.isMesh || renderable.isPoints || renderable.isLine) && renderable.material) {
      const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      const fresh = list.filter((material) => !seen.has(material));
      fresh.forEach((material) => seen.add(material));
      if (fresh.length > 0) objects.push({ object, materials: fresh });
    }
    for (const child of object.children) visit(child, false);
  };
  visit(root, true);
  return objects.map(
    ({ object, materials }) =>
      () =>
        withTarget(() => {
          gl.compile(object, camera, scene);
          for (const material of materials) {
            const properties = gl.properties.get(material) as { currentProgram?: ProgramHandle };
            properties.currentProgram?.getUniforms();
          }
        }),
  );
}
