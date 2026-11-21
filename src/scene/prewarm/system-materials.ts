import { AdditiveBlending, Color, ShaderMaterial } from 'three';
import { coronaFragment, coronaVertex } from '../shaders/corona';
import { buildCoreFragment, buildCoreVertex } from '../shaders/node-core';
import { liquidMetalFragment } from '../shaders/planet-materials';
import { planetVertex } from '../shaders/planet-common';
import { CORONA_SCALE } from '../system/constants';
import {
  createCometTailMaterial,
  createPlanetMaterials,
  createSystemUniforms,
  disposePlanetMaterials,
  type PlanetMaterials,
  type SystemUniforms,
} from '../system/planet-materials';
import { fogUniforms } from '../three-utils';
import { CORE_STYLES } from '../universe/core-styles';
import type { CategoryNodeModel } from '../universe/model';

/** Every material of one category's system view. */
export interface SystemMaterials {
  /** Shared per-frame uniforms (time, core position and colour). */
  uniforms: SystemUniforms;
  core: ShaderMaterial;
  corona: ShaderMaterial;
  /** Forge core: the mechanical rim (liquid metal). */
  rim: ShaderMaterial | null;
  /** Comet core: the particle tail. */
  tail: ShaderMaterial | null;
  /** In `node.orbits` order. */
  planets: PlanetMaterials[];
}

/**
 * Materials of the system content (styled core, corona, core extras and
 * every planet with its shell, rings, moons, trail and glow), created
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
    const created = createSystemMaterials(node, lowQuality);
    this.entries.set(key, created);
    return created;
  }

  /** Disposes the materials of the other quality variant. */
  retain(lowQuality: boolean): void {
    const suffix = lowQuality ? '|low' : '|full';
    for (const [key, materials] of this.entries) {
      if (key.endsWith(suffix)) continue;
      disposeSystemMaterials(materials);
      this.entries.delete(key);
    }
  }

  dispose(): void {
    for (const materials of this.entries.values()) disposeSystemMaterials(materials);
    this.entries.clear();
  }
}

function createSystemMaterials(node: CategoryNodeModel, lowQuality: boolean): SystemMaterials {
  const style = CORE_STYLES[node.core];
  const uniforms = createSystemUniforms(node.color);
  const quality = lowQuality ? { LOW_QUALITY: '' } : {};
  const core = new ShaderMaterial({
    name: `system-core:${node.categoryId}`,
    vertexShader: buildCoreVertex(style.deform && !lowQuality),
    fragmentShader: buildCoreFragment(style.chunk),
    defines: { ...quality, DETAIL: '' },
    uniforms: {
      ...fogUniforms(),
      uColor: { value: new Color(node.color) },
      uGlow: { value: new Color(node.glow) },
      uTime: uniforms.uTime,
      uEmphasis: { value: 0 },
      uSeed: { value: node.index * 3.7 },
      uSmall: { value: 0 },
      uPresence: { value: 1 },
      uDetail: { value: 0 },
    },
  });
  const corona = new ShaderMaterial({
    name: `system-corona:${node.categoryId}`,
    vertexShader: coronaVertex,
    fragmentShader: coronaFragment,
    defines: quality,
    uniforms: {
      ...fogUniforms(),
      uColor: { value: new Color(node.color) },
      uGlow: { value: new Color(node.glow) },
      uTime: uniforms.uTime,
      uSeed: { value: node.index * 5.1 },
      uIntensity: { value: 0 },
      uCoreRadius: { value: 0.24 },
      uReach: { value: CORONA_SCALE },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const rim =
    style.extra === 'forge-rim'
      ? new ShaderMaterial({
          name: `forge-rim:${node.categoryId}`,
          vertexShader: planetVertex,
          fragmentShader: liquidMetalFragment,
          defines: quality,
          uniforms: {
            ...fogUniforms(),
            ...uniforms,
            uColor: { value: new Color(node.color) },
            uGlow: { value: new Color(node.glow) },
            uSeed: { value: node.index * 1.9 },
            uHover: { value: 0 },
            uFade: { value: 1 },
            uDim: { value: 1 },
            uDeform: { value: 0 },
          },
        })
      : null;
  const tail =
    style.extra === 'comet-tail'
      ? createCometTailMaterial(node.color, node.glow, uniforms, lowQuality)
      : null;
  const planets = node.orbits.map((orbit, index) =>
    createPlanetMaterials(orbit, uniforms, node.index * 11 + index * 3.3, lowQuality),
  );
  return { uniforms, core, corona, rim, tail, planets };
}

function disposeSystemMaterials(materials: SystemMaterials): void {
  materials.core.dispose();
  materials.corona.dispose();
  materials.rim?.dispose();
  materials.tail?.dispose();
  materials.planets.forEach(disposePlanetMaterials);
}
