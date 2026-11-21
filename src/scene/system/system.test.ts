import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import {
  coreStyleSchema,
  moonsSchema,
  planetMaterialSchema,
  planetShapeSchema,
} from '~/content/schema';
import { SYSTEM_BASE_TILT } from '../config';
import { orbitPosition } from '../orbit-math';
import { SystemMaterialCache } from '../prewarm/system-materials';
import { buildCoreFragment } from '../shaders/node-core';
import type { SceneManifest } from '../types';
import { CORE_STYLES } from '../universe/core-styles';
import { buildUniverseModel } from '../universe/model';
import { createMoonPose, moonPose } from './moon-layout';
import { MOON_SHAPES, PLANET_SHAPES } from './planet-geometry';
import {
  PLANET_SPEED,
  SHELL_SCALE,
  freeOrbitAngle,
  planetLocalPosition,
  planetReach,
  planetSpeedTarget,
  planetWorldPosition,
} from './planet-math';
import { PLANET_MATERIALS } from './planet-materials';

const manifest: SceneManifest = {
  labels: { portfolio: 'Portfolio', configurator: 'Configurator', comingSoon: 'Coming soon' },
  categories: getCategories().map((category) => ({
    id: category.id,
    label: category.id,
    dna: category.dna,
    services: category.services.map((service) => ({
      slug: service.slug,
      label: service.slug,
      planet: service.planet,
    })),
  })),
  projects: [],
};
const model = buildUniverseModel(manifest);

describe('system registries cover every DNA value', () => {
  it('has a geometry for every shape, a shader for every material and core style, a moon shape for every kind', () => {
    expect(Object.keys(PLANET_SHAPES).sort()).toEqual([...planetShapeSchema.options].sort());
    expect(Object.keys(PLANET_MATERIALS).sort()).toEqual([...planetMaterialSchema.options].sort());
    expect(Object.keys(CORE_STYLES).sort()).toEqual([...coreStyleSchema.options].sort());
    expect(Object.keys(MOON_SHAPES).sort()).toEqual([...moonsSchema.shape.kind.options].sort());
  });

  it('builds valid, roughly unit-sized geometry for every shape at every detail', () => {
    for (const [name, entry] of Object.entries(PLANET_SHAPES)) {
      for (const detail of [0, 1, 2]) {
        const geometry = entry.create(detail, 3);
        const position = geometry.getAttribute('position');
        expect(position.count, name).toBeGreaterThan(3);
        expect(geometry.getAttribute('normal'), name).toBeDefined();
        for (let i = 0; i < position.array.length; i++) {
          expect(Number.isFinite(position.array[i]), name).toBe(true);
        }
        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere!.radius;
        expect(radius, name).toBeGreaterThan(0.5);
        expect(radius, name).toBeLessThanOrEqual(entry.extent + 0.05);
        geometry.dispose();
      }
    }
    for (const create of Object.values(MOON_SHAPES)) {
      const geometry = create();
      expect(geometry.getAttribute('position').count).toBeGreaterThan(3);
      geometry.dispose();
    }
  });

  it('gives every core style its own program source', () => {
    const sources = Object.values(CORE_STYLES).map((style) => buildCoreFragment(style.chunk));
    expect(new Set(sources).size).toBe(sources.length);
    for (const source of sources) {
      expect(source).toContain('vec3 coreStyle(');
      expect(source).toContain('#include <colorspace_fragment>');
    }
    // The universe core has no style function at all.
    expect(buildCoreFragment('')).not.toContain('vec3 coreStyle(');
  });
});

describe('planet maths', () => {
  const orbit = model.categories[0]!.orbits[1]!;

  it('places planets on the preview orbit, inside the tilted system plane', () => {
    const angle = 1.234;
    const flat = orbitPosition(orbit, angle, { x: 0, y: 0, z: 0 });
    const [x, y, z] = planetLocalPosition(orbit, angle);
    expect(Math.hypot(x, y, z)).toBeCloseTo(orbit.radius, 9);
    expect(x).toBeCloseTo(flat.x, 9);
    expect(y).toBeCloseTo(
      flat.y * Math.cos(SYSTEM_BASE_TILT) - flat.z * Math.sin(SYSTEM_BASE_TILT),
      9,
    );
    const world = planetWorldPosition([1, 2, 3], orbit, angle);
    expect(world).toEqual([1 + x, 2 + y, 3 + z]);
    expect(freeOrbitAngle(orbit, 10)).toBeCloseTo(orbit.phase + orbit.speed * 10);
  });

  it('measures the reach of shells, rings and moons', () => {
    for (const category of model.categories) {
      for (const candidate of category.orbits) {
        const { planet } = candidate;
        const reach = planetReach(candidate);
        expect(reach).toBeGreaterThanOrEqual(candidate.size);
        for (const ring of planet.rings) {
          expect(reach).toBeGreaterThanOrEqual(candidate.size * ring.outer - 1e-9);
        }
        if (planet.moons) {
          expect(reach).toBeGreaterThan(candidate.size * planet.moons.radius);
        }
        if (planet.shell !== 'none') {
          expect(reach).toBeGreaterThanOrEqual(candidate.size * SHELL_SCALE - 1e-9);
        }
      }
    }
  });

  it('slows hovered planets and parks the focused one', () => {
    expect(planetSpeedTarget(false, false)).toBe(PLANET_SPEED.normal);
    expect(planetSpeedTarget(false, true)).toBe(PLANET_SPEED.hovered);
    expect(planetSpeedTarget(true, true)).toBe(PLANET_SPEED.focused);
    expect(PLANET_SPEED.hovered).toBeLessThan(0.5);
  });
});

describe('moon layout', () => {
  it('keeps every moon on its radius', () => {
    const pose = createMoonPose();
    for (const kind of ['orb', 'cube', 'conveyor', 'shard'] as const) {
      for (let i = 0; i < 5; i++) {
        moonPose(kind, i, 5, 3.7, 1.8, 0.6, pose);
        expect(Math.hypot(pose.x, pose.y, pose.z)).toBeCloseTo(1.8, 9);
        expect(pose.sx).toBeGreaterThan(0);
      }
    }
  });

  it('runs conveyor boxes evenly spaced on a flat track, aligned with it', () => {
    const pose = createMoonPose();
    const angles: number[] = [];
    for (let i = 0; i < 6; i++) {
      moonPose('conveyor', i, 6, 2, 2, 0.8, pose);
      expect(pose.y).toBeCloseTo(0, 9);
      const angle = Math.atan2(pose.z, pose.x);
      angles.push(angle);
      // Local +Z after the Y rotation points along the track tangent.
      const forward = [Math.sin(pose.ry), Math.cos(pose.ry)];
      const tangent = [-Math.sin(angle), Math.cos(angle)];
      expect(forward[0]! * tangent[0]! + forward[1]! * tangent[1]!).toBeCloseTo(1, 6);
    }
    const gaps = angles.map((a, i) => {
      const next = angles[(i + 1) % angles.length]!;
      return (((next - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    });
    gaps.forEach((gap) => expect(gap).toBeCloseTo((Math.PI * 2) / 6, 6));
  });
});

describe('system materials', () => {
  it('builds every material of every system, sharing per-frame uniforms, with a low-tier variant', () => {
    const cache = new SystemMaterialCache();
    for (const node of model.categories) {
      const full = cache.get(node, false);
      const low = cache.get(node, true);
      expect(cache.get(node, false)).toBe(full);
      expect(full.planets).toHaveLength(node.orbits.length);
      expect(low.core.defines).toHaveProperty('LOW_QUALITY');
      expect(full.core.defines).not.toHaveProperty('LOW_QUALITY');
      expect(full.core.defines).toHaveProperty('DETAIL');
      expect(full.rim !== null).toBe(CORE_STYLES[node.core].extra === 'forge-rim');
      expect(full.tail !== null).toBe(CORE_STYLES[node.core].extra === 'comet-tail');
      node.orbits.forEach((orbit, index) => {
        const planet = full.planets[index]!;
        const entry = PLANET_MATERIALS[orbit.planet.material];
        expect(planet.surface.transparent).toBe(entry.transparent);
        expect(planet.surface.depthWrite).toBe(!entry.transparent);
        // One uniform object per system: a single write per frame updates all planets.
        expect(planet.surface.uniforms.uTime).toBe(full.uniforms.uTime);
        expect(planet.surface.uniforms.uCorePos).toBe(full.uniforms.uCorePos);
        expect(planet.rings).toHaveLength(orbit.planet.rings.length);
        expect(planet.moons !== null).toBe(orbit.planet.moons !== undefined);
        expect(planet.trail !== null).toBe(orbit.planet.trail);
        expect(planet.shell !== null).toBe(orbit.planet.shell !== 'none');
        // The blob shape deforms in the vertex shader (not on the low tier).
        const deform = PLANET_SHAPES[orbit.planet.shape].deform > 0;
        expect('DEFORM' in planet.surface.defines).toBe(deform);
        expect('DEFORM' in low.planets[index]!.surface.defines).toBe(false);
      });
    }
    cache.retain(false);
    expect(cache.get(model.categories[0]!, false)).toBeDefined();
    cache.dispose();
  });
});
