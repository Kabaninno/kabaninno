import { AdditiveBlending, Color, ShaderMaterial, Vector4 } from 'three';
import { coronaFragment, coronaVertex } from '../shaders/corona';
import { nodeCoreFragment, nodeCoreVertex } from '../shaders/node-core';
import { CORONA_SCALE } from '../system/constants';
import { fogUniforms } from '../three-utils';
import { CORE_STYLES } from '../universe/core-styles';
import type { CategoryNodeModel } from '../universe/model';

export interface SystemMaterials {
  core: ShaderMaterial;
  corona: ShaderMaterial;
}

/**
 * Materials of the system content (detailed core + corona), created
 * imperatively and owned by the Experience — NOT by the components that
 * render them. Prewarmed content mounts, compiles and unmounts (its geometry
 * is disposed with it, B2.2), but three deletes a program as soon as no live
 * material uses it, so the materials must outlive the mount for the compile
 * to pay off. Disposed on tier change (`retain`) and on unmount (`dispose`).
 */
export class SystemMaterialCache {
  private readonly entries = new Map<string, SystemMaterials>();

  get(node: CategoryNodeModel, lowQuality: boolean): SystemMaterials {
    const key = `${node.key}|${lowQuality ? 'low' : 'full'}`;
    const cached = this.entries.get(key);
    if (cached) return cached;
    const defines: Record<string, string> = lowQuality
      ? { LOW_QUALITY: '', DETAIL: '' }
      : { DETAIL: '' };
    const style = CORE_STYLES[node.core];
    const fog = () => fogUniforms();
    const created: SystemMaterials = {
      core: new ShaderMaterial({
        name: `system-core:${node.categoryId}`,
        vertexShader: nodeCoreVertex,
        fragmentShader: nodeCoreFragment,
        defines,
        uniforms: {
          ...fog(),
          uColor: { value: new Color(node.color) },
          uGlow: { value: new Color(node.glow) },
          uTime: { value: 0 },
          uEmphasis: { value: 0 },
          uSeed: { value: node.index * 3.7 },
          uSmall: { value: 0 },
          uPresence: { value: 1 },
          uDetail: { value: 0 },
          uStyleA: { value: new Vector4(...style.a) },
          uStyleB: { value: new Vector4(...style.b) },
          uFacet: { value: style.facet },
        },
      }),
      corona: new ShaderMaterial({
        name: `system-corona:${node.categoryId}`,
        vertexShader: coronaVertex,
        fragmentShader: coronaFragment,
        defines: lowQuality ? { LOW_QUALITY: '' } : {},
        uniforms: {
          ...fog(),
          uColor: { value: new Color(node.color) },
          uGlow: { value: new Color(node.glow) },
          uTime: { value: 0 },
          uSeed: { value: node.index * 5.1 },
          uIntensity: { value: 0 },
          uCoreRadius: { value: 0.24 },
          uReach: { value: CORONA_SCALE },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    };
    this.entries.set(key, created);
    return created;
  }

  /** Disposes the materials of the other quality variant. */
  retain(lowQuality: boolean): void {
    const suffix = lowQuality ? '|low' : '|full';
    for (const [key, materials] of this.entries) {
      if (key.endsWith(suffix)) continue;
      materials.core.dispose();
      materials.corona.dispose();
      this.entries.delete(key);
    }
  }

  dispose(): void {
    for (const materials of this.entries.values()) {
      materials.core.dispose();
      materials.corona.dispose();
    }
    this.entries.clear();
  }
}
