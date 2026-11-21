import {
  AdditiveBlending,
  Color,
  NormalBlending,
  ShaderMaterial,
  Vector2,
  Vector3,
  type IUniform,
} from 'three';
import { PALETTE } from '../config';
import {
  archiveCardFragment,
  archiveEmblemFragment,
  observatoryRingsFragment,
  observatoryRingsVertex,
} from '../shaders/archive';
import { haloFragment, haloVertex } from '../shaders/halo';
import { planetVertex } from '../shaders/planet-common';
import { lineFragment, lineVertex } from '../shaders/system-parts';
import {
  createSystemUniforms,
  type PlanetUniforms,
  type SystemUniforms,
} from '../system/planet-materials';
import { fogUniforms } from '../three-utils';
import type { ArchiveProjectModel, PortfolioNodeModel } from '../universe/model';
import { ARCHIVE } from './archive-layout';

/** Per-card uniforms: the planet set (hover, fade, dim) plus the filter emphasis. */
export interface CardUniforms extends PlanetUniforms {
  uSelect: IUniform<number>;
}

/** Every material of one project card-object. */
export interface CardMaterials {
  uniforms: CardUniforms;
  /** Glass slab with the holographic face. */
  card: ShaderMaterial;
  /** Glowing outline of the slab. */
  edges: ShaderMaterial;
  /** Category emblem (self-lit). */
  emblem: ShaderMaterial;
  /** Soft glow behind the card. */
  glow: ShaderMaterial;
}

/** Every material of the archive view. */
export interface ArchiveMaterials {
  /** Shared per-frame uniforms: time, the cluster core (the light) and its colour. */
  uniforms: SystemUniforms;
  rings: ShaderMaterial;
  /** In `node.projects` order. */
  cards: CardMaterials[];
}

function defines(lowQuality: boolean): Record<string, string> {
  return lowQuality ? { LOW_QUALITY: '' } : {};
}

function createCardUniforms(project: ArchiveProjectModel, seed: number): CardUniforms {
  return {
    uColor: { value: new Color(project.color) },
    uGlow: { value: new Color(project.glow) },
    uSeed: { value: seed },
    uHover: { value: 0 },
    uFade: { value: 0 },
    uDim: { value: 1 },
    uSelect: { value: 0 },
  };
}

export function createCardMaterials(
  project: ArchiveProjectModel,
  system: SystemUniforms,
  seed: number,
  lowQuality: boolean,
): CardMaterials {
  const uniforms = createCardUniforms(project, seed);
  const chips = Array.from({ length: 4 }, (_, i) => {
    const color = new Color(project.chips[i] ?? project.color);
    return new Vector3(color.r, color.g, color.b);
  });
  const card = new ShaderMaterial({
    name: `archive-card:${project.slug}`,
    vertexShader: planetVertex,
    fragmentShader: archiveCardFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      ...system,
      ...uniforms,
      uDeform: { value: 0 },
      uHalfSize: { value: new Vector2(ARCHIVE.cardWidth / 2, ARCHIVE.cardHeight / 2) },
      uHalfDepth: { value: ARCHIVE.cardDepth / 2 },
      uChips: { value: chips },
      uChipCount: { value: Math.min(project.chips.length, 4) },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const edges = new ShaderMaterial({
    name: `archive-edges:${project.slug}`,
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    defines: defines(lowQuality),
    uniforms: { ...fogUniforms(), ...system, ...uniforms, uOpacity: { value: 0.75 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const emblem = new ShaderMaterial({
    name: `archive-emblem:${project.slug}`,
    vertexShader: planetVertex,
    fragmentShader: archiveEmblemFragment,
    defines: defines(lowQuality),
    uniforms: { ...fogUniforms(), ...system, ...uniforms, uDeform: { value: 0 } },
  });
  const glow = new ShaderMaterial({
    name: `archive-glow:${project.slug}`,
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      uColor: uniforms.uColor,
      uGlow: uniforms.uGlow,
      uSize: { value: ARCHIVE.cardHeight * 0.95 },
      // Behind the card (a negative lift pushes the billboard away from the camera).
      uLift: { value: -0.35 },
      uIntensity: { value: 0 },
      uEmphasis: uniforms.uHover,
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return { uniforms, card, edges, emblem, glow };
}

function createRingsMaterial(system: SystemUniforms, lowQuality: boolean): ShaderMaterial {
  return new ShaderMaterial({
    name: 'archive-rings',
    vertexShader: observatoryRingsVertex,
    fragmentShader: observatoryRingsFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      uTime: system.uTime,
      uColor: { value: new Color(PALETTE.portfolio) },
      uAccent: { value: new Color(PALETTE.portfolioGlow) },
      uIntensity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

function createArchiveMaterials(node: PortfolioNodeModel, lowQuality: boolean): ArchiveMaterials {
  const uniforms = createSystemUniforms(PALETTE.portfolioGlow);
  return {
    uniforms,
    rings: createRingsMaterial(uniforms, lowQuality),
    cards: node.projects.map((project, index) =>
      createCardMaterials(project, uniforms, 5.3 + index * 2.7, lowQuality),
    ),
  };
}

function disposeArchiveMaterials(materials: ArchiveMaterials): void {
  materials.rings.dispose();
  for (const card of materials.cards) {
    card.card.dispose();
    card.edges.dispose();
    card.emblem.dispose();
    card.glow.dispose();
  }
}

/**
 * Materials of the archive view, owned by the Experience like the system
 * materials (see prewarm/system-materials.ts): the prewarm mounts the
 * archive off-screen, compiles and unmounts it, and the programs survive
 * because these materials do. Disposed on tier change (`retain`) and unmount.
 */
export class ArchiveMaterialCache {
  private readonly entries = new Map<string, ArchiveMaterials>();

  get(node: PortfolioNodeModel, lowQuality: boolean): ArchiveMaterials {
    const key = `${node.projectSlugs.join(',')}|${lowQuality ? 'low' : 'full'}`;
    const cached = this.entries.get(key);
    if (cached) return cached;
    const created = createArchiveMaterials(node, lowQuality);
    this.entries.set(key, created);
    return created;
  }

  /** Disposes the materials of the other quality variant. */
  retain(lowQuality: boolean): void {
    const suffix = lowQuality ? '|low' : '|full';
    for (const [key, materials] of this.entries) {
      if (key.endsWith(suffix)) continue;
      disposeArchiveMaterials(materials);
      this.entries.delete(key);
    }
  }

  dispose(): void {
    for (const materials of this.entries.values()) disposeArchiveMaterials(materials);
    this.entries.clear();
  }
}
