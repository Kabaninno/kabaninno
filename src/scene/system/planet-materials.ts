import {
  AdditiveBlending,
  Color,
  DoubleSide,
  FrontSide,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type Blending,
  type IUniform,
  type Side,
} from 'three';
import type { Planet } from '~/content/schema';
import { haloFragment, haloVertex } from '../shaders/halo';
import {
  emissiveFragment,
  glassFragment,
  hologramFragment,
  iridescentFragment,
  liquidMetalFragment,
} from '../shaders/planet-materials';
import { planetVertex } from '../shaders/planet-common';
import {
  cometTailFragment,
  cometTailVertex,
  lineFragment,
  lineVertex,
  moonFragment,
  ringFragment,
  ringVertex,
  trailFragment,
  trailVertex,
} from '../shaders/system-parts';
import { fogUniforms } from '../three-utils';
import type { OrbitPreview } from '../universe/model';
import { PLANET_SHAPES } from './planet-geometry';

export type PlanetMaterial = Planet['material'];

/**
 * Registry: DNA `material` → surface shader and how it blends. Transparent
 * materials (glass, hologram) do not write depth; opaque ones do. A new
 * material value only needs an entry here (TypeScript enforces it).
 */
export interface MaterialEntry {
  fragment: string;
  transparent: boolean;
  additive: boolean;
}

export const PLANET_MATERIALS: Record<PlanetMaterial, MaterialEntry> = {
  glass: { fragment: glassFragment, transparent: true, additive: false },
  'liquid-metal': { fragment: liquidMetalFragment, transparent: false, additive: false },
  hologram: { fragment: hologramFragment, transparent: true, additive: true },
  iridescent: { fragment: iridescentFragment, transparent: false, additive: false },
  emissive: { fragment: emissiveFragment, transparent: false, additive: false },
};

/** Uniforms shared by every material of one system (one update per frame). */
export interface SystemUniforms {
  uTime: IUniform<number>;
  /** Core centre, world space (the light). */
  uCorePos: IUniform<Vector3>;
  uCoreColor: IUniform<Color>;
}

export function createSystemUniforms(coreColor: string): SystemUniforms {
  return {
    uTime: { value: 0 },
    uCorePos: { value: new Vector3() },
    uCoreColor: { value: new Color(coreColor).multiplyScalar(1.15) },
  };
}

/** Uniforms shared by every material of one planet (hover, materialize). */
export interface PlanetUniforms {
  uColor: IUniform<Color>;
  uGlow: IUniform<Color>;
  uSeed: IUniform<number>;
  uHover: IUniform<number>;
  uFade: IUniform<number>;
  /** Siblings of a focused planet recede (1 = normal). */
  uDim: IUniform<number>;
}

export function createPlanetUniforms(orbit: OrbitPreview, seed: number): PlanetUniforms {
  return {
    uColor: { value: new Color(orbit.color) },
    uGlow: { value: new Color(orbit.glow) },
    uSeed: { value: seed },
    uHover: { value: 0 },
    uFade: { value: 1 },
    uDim: { value: 1 },
  };
}

function defines(lowQuality: boolean, extra: Record<string, string> = {}): Record<string, string> {
  return lowQuality ? { LOW_QUALITY: '', ...extra } : { ...extra };
}

function blendingOf(additive: boolean): Blending {
  return additive ? AdditiveBlending : NormalBlending;
}

export function createSurfaceMaterial(
  orbit: OrbitPreview,
  system: SystemUniforms,
  planet: PlanetUniforms,
  lowQuality: boolean,
): ShaderMaterial {
  const entry = PLANET_MATERIALS[orbit.planet.material];
  const shape = PLANET_SHAPES[orbit.planet.shape];
  const deform = shape.deform > 0 && !lowQuality;
  const side: Side = shape.doubleSided || entry.additive ? DoubleSide : FrontSide;
  return new ShaderMaterial({
    name: `planet:${orbit.serviceSlug}`,
    vertexShader: planetVertex,
    fragmentShader: entry.fragment,
    defines: defines(lowQuality, deform ? { DEFORM: '' } : {}),
    uniforms: {
      ...fogUniforms(),
      ...system,
      ...planet,
      uDeform: { value: shape.deform },
      uOpacity: { value: 1 },
    },
    transparent: entry.transparent,
    depthWrite: !entry.transparent,
    blending: blendingOf(entry.additive),
    side,
  });
}

/** Shell around the planet: a pulsing wireframe lattice or a hologram skin. */
export function createShellMaterial(
  orbit: OrbitPreview,
  system: SystemUniforms,
  planet: PlanetUniforms,
  lowQuality: boolean,
): ShaderMaterial | null {
  const shell = orbit.planet.shell;
  if (shell === 'none') return null;
  if (shell === 'wireframe') {
    return new ShaderMaterial({
      name: `shell-wire:${orbit.serviceSlug}`,
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      defines: defines(lowQuality),
      uniforms: { ...fogUniforms(), ...system, ...planet, uOpacity: { value: 0.55 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  }
  return new ShaderMaterial({
    name: `shell-holo:${orbit.serviceSlug}`,
    vertexShader: planetVertex,
    fragmentShader: hologramFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      ...system,
      ...planet,
      uDeform: { value: 0 },
      uOpacity: { value: 0.42 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

export function createRingMaterial(
  ring: Planet['rings'][number],
  orbit: OrbitPreview,
  system: SystemUniforms,
  planet: PlanetUniforms,
  lowQuality: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    name: `ring:${orbit.serviceSlug}`,
    vertexShader: ringVertex,
    fragmentShader: ringFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      ...system,
      ...planet,
      uInner: { value: ring.inner },
      uOuter: { value: ring.outer },
      uBands: { value: ring.bands },
      uOpacity: { value: ring.opacity },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

export function createMoonMaterial(
  orbit: OrbitPreview,
  system: SystemUniforms,
  planet: PlanetUniforms,
  lowQuality: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    name: `moons:${orbit.serviceSlug}`,
    vertexShader: planetVertex,
    fragmentShader: moonFragment,
    defines: defines(lowQuality),
    uniforms: { ...fogUniforms(), ...system, ...planet, uDeform: { value: 0 } },
  });
}

/** Conveyor track and other thin guide lines. */
export function createTrackMaterial(
  orbit: OrbitPreview,
  system: SystemUniforms,
  planet: PlanetUniforms,
  lowQuality: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    name: `track:${orbit.serviceSlug}`,
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    defines: defines(lowQuality),
    uniforms: { ...fogUniforms(), ...system, ...planet, uOpacity: { value: 0.35 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

export function createTrailMaterial(
  orbit: OrbitPreview,
  system: SystemUniforms,
  planet: PlanetUniforms,
  lowQuality: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    name: `trail:${orbit.serviceSlug}`,
    vertexShader: trailVertex,
    fragmentShader: trailFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      ...system,
      uColor: planet.uColor,
      uGlow: planet.uGlow,
      uFade: planet.uFade,
      uDim: planet.uDim,
      uHead: { value: 0 },
      uArc: { value: 1.1 },
      uRadius: { value: orbit.radius },
      uTilt: { value: orbit.tilt },
      uYaw: { value: orbit.yaw },
      uSize: { value: orbit.size * 0.9 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/** Planet glow billboard (the universe halo program, per-planet uniforms). */
export function createGlowMaterial(
  orbit: OrbitPreview,
  planet: PlanetUniforms,
  lowQuality: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    name: `glow:${orbit.serviceSlug}`,
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      uColor: planet.uColor,
      uGlow: planet.uGlow,
      uSize: { value: orbit.size * 2.4 },
      uLift: { value: orbit.size },
      uIntensity: { value: 0.55 },
      uEmphasis: planet.uHover,
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/** Comet-core tail particles. */
export function createCometTailMaterial(
  color: string,
  glow: string,
  system: SystemUniforms,
  lowQuality: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    name: 'comet-tail',
    vertexShader: cometTailVertex,
    fragmentShader: cometTailFragment,
    defines: defines(lowQuality),
    uniforms: {
      ...fogUniforms(),
      uTime: system.uTime,
      uColor: { value: new Color(color) },
      uGlow: { value: new Color(glow) },
      uCoreRadius: { value: 0.24 },
      uLength: { value: 1.6 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
      uIntensity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/** Every material of one planet. */
export interface PlanetMaterials {
  uniforms: PlanetUniforms;
  surface: ShaderMaterial;
  shell: ShaderMaterial | null;
  rings: ShaderMaterial[];
  moons: ShaderMaterial | null;
  track: ShaderMaterial | null;
  trail: ShaderMaterial | null;
  glow: ShaderMaterial;
}

export function createPlanetMaterials(
  orbit: OrbitPreview,
  system: SystemUniforms,
  seed: number,
  lowQuality: boolean,
): PlanetMaterials {
  const uniforms = createPlanetUniforms(orbit, seed);
  const { planet } = orbit;
  return {
    uniforms,
    surface: createSurfaceMaterial(orbit, system, uniforms, lowQuality),
    shell: createShellMaterial(orbit, system, uniforms, lowQuality),
    rings: planet.rings.map((ring) =>
      createRingMaterial(ring, orbit, system, uniforms, lowQuality),
    ),
    moons: planet.moons ? createMoonMaterial(orbit, system, uniforms, lowQuality) : null,
    track:
      planet.moons?.kind === 'conveyor'
        ? createTrackMaterial(orbit, system, uniforms, lowQuality)
        : null,
    trail: planet.trail ? createTrailMaterial(orbit, system, uniforms, lowQuality) : null,
    glow: createGlowMaterial(orbit, uniforms, lowQuality),
  };
}

export function disposePlanetMaterials(materials: PlanetMaterials): void {
  for (const material of [
    materials.surface,
    materials.shell,
    ...materials.rings,
    materials.moons,
    materials.track,
    materials.trail,
    materials.glow,
  ]) {
    material?.dispose();
  }
}
