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
  planetScreenBoost,
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

describe('focus core look (S2)', () => {
  it('dims the core harder where no side can clear it', async () => {
    const { coreClearable, focusCoreLook } = await import('./planet-math');
    const { CORE_KEEP_OUT } = await import('./constants');
    const orbits = model.categories.flatMap((node) => node.orbits);
    expect(focusCoreLook(undefined)).toEqual({ dim: 1, corona: 1, tail: 1 });
    for (const orbit of orbits) {
      const clearable = orbit.radius >= CORE_KEEP_OUT + planetReach(orbit) + 1.5 * orbit.size;
      expect(coreClearable(orbit)).toBe(clearable);
      const look = focusCoreLook(orbit);
      expect(look.dim).toBeLessThanOrEqual(0.5);
      if (!clearable) expect(look.dim).toBeLessThanOrEqual(0.3);
      expect(look.corona).toBeLessThan(0.6);
    }
    // The content has both kinds (inner orbits exist).
    expect(orbits.some((orbit) => !coreClearable(orbit))).toBe(true);
  });
});

describe('trail follows the planet speed (S1)', () => {
  it('vanishes for a parked planet and shows while it orbits', async () => {
    const { trailIntensity, PLANET_SPEED } = await import('./planet-math');
    expect(trailIntensity(PLANET_SPEED.focused)).toBe(0);
    expect(trailIntensity(PLANET_SPEED.normal)).toBe(1);
    expect(trailIntensity(-PLANET_SPEED.normal)).toBe(1);
    expect(trailIntensity(PLANET_SPEED.hovered)).toBeGreaterThan(0.3);
    expect(trailIntensity(PLANET_SPEED.hovered)).toBeLessThan(1);
  });

  it('gives every trail material the speed-driven strength uniform', () => {
    const cache = new SystemMaterialCache();
    for (const node of model.categories) {
      const materials = cache.get(node, false);
      materials.planets.forEach((planet, i) => {
        if (node.orbits[i]!.planet.trail) expect(planet.trail?.uniforms.uTrail).toBeDefined();
      });
    }
    cache.dispose();
  });
});

describe('focused planets stay visible (BL-F3-01)', () => {
  it('floors every planet body, rim and glow in focus, for every material × shell', async () => {
    const { FOCUS_GLOW_FLOOR, PLANET_MATERIALS: registry } = await import('./planet-materials');
    const cache = new SystemMaterialCache();
    const planets = model.categories.flatMap((node) =>
      node.orbits.map((orbit, i) => ({ node, orbit, i })),
    );
    expect(planets).toHaveLength(20);
    for (const { node, orbit, i } of planets) {
      const { material, shell } = orbit.planet;
      const look = registry[material].look;
      const label = `${node.categoryId}/${orbit.serviceSlug} (${material}, shell ${shell})`;
      // Visibility proxy: an opaque body, or a transparent one with a floor and a strong rim.
      expect(look.minOpacity, label).toBeGreaterThanOrEqual(0.35);
      if (registry[material].transparent) {
        expect(look.rim, label).toBeGreaterThanOrEqual(0.6);
      }
      // The shaders get exactly these values, and the glow keeps a floor near the camera.
      const materials = cache.get(node, false).planets[i]!;
      expect(materials.surface.uniforms.uMinOpacity?.value, label).toBe(look.minOpacity);
      expect(materials.surface.uniforms.uRim?.value, label).toBe(look.rim);
      expect(materials.glow.uniforms.uNearFloor?.value, label).toBeGreaterThanOrEqual(0.35);
    }
    expect(FOCUS_GLOW_FLOOR).toBeGreaterThanOrEqual(0.35);
    // Every material × shell combination the schema allows meets the same floor.
    for (const material of Object.keys(registry) as Array<keyof typeof registry>) {
      const { look, transparent } = registry[material];
      expect(look.minOpacity).toBeGreaterThanOrEqual(0.35);
      if (transparent) expect(look.rim).toBeGreaterThanOrEqual(0.6);
    }
    cache.dispose();
  });

  it('hides the comet tail in planet focus and fades nearby particles', async () => {
    const { focusCoreLook } = await import('./planet-math');
    const { cometTailVertex } = await import('../shaders/system-parts');
    for (const orbit of model.categories.flatMap((node) => node.orbits)) {
      expect(focusCoreLook(orbit).tail).toBe(0);
    }
    expect(focusCoreLook(undefined).tail).toBe(1);
    expect(cometTailVertex).toContain('nearFade');
  });

  it('cuts orb moons into facets (no plain glossy spheres, MJ-F3-01)', () => {
    const orb = MOON_SHAPES.orb();
    // Flat shading: no shared vertices, so each face has its own normal.
    expect(orb.index).toBeNull();
    orb.dispose();
  });
});

describe('universe preview leaves the system view (MJ-F3-02)', () => {
  it('hides the sparks once the route focuses the category, even with a small core', async () => {
    const { previewVisibility } = await import('./constants');
    expect(previewVisibility(0, 0)).toBe(1);
    // Phone system view: focused, but the core never reaches the full detail size.
    expect(previewVisibility(1, 0.3)).toBe(0);
    expect(previewVisibility(0.6, 0)).toBe(0);
    expect(previewVisibility(0.3, 0)).toBeGreaterThan(0);
    expect(previewVisibility(0.3, 0)).toBeLessThan(1);
  });
});

describe('small planets grow by their visible body (MJ-F3-03)', () => {
  it('boosts thin and flat bodies more than round ones of the same size', async () => {
    const { MAX_PLANET_BOOST, MIN_PLANET_DIAMETER_PX } = await import('./planet-math');
    const ppu = 40;
    const size = 0.12;
    const round = planetScreenBoost(size * PLANET_SHAPES.sphere.body, ppu);
    const gear = planetScreenBoost(size * PLANET_SHAPES.gear.body, ppu);
    expect(gear).toBeGreaterThan(round);
    for (const shape of Object.values(PLANET_SHAPES)) {
      expect(shape.body).toBeGreaterThan(0);
      expect(shape.body).toBeLessThanOrEqual(1);
      const boost = planetScreenBoost(size * shape.body, ppu);
      const px = 2 * size * shape.body * ppu * boost;
      // Reaches the minimum body size unless the boost is capped.
      if (boost < MAX_PLANET_BOOST)
        expect(px).toBeGreaterThanOrEqual(MIN_PLANET_DIAMETER_PX - 1e-9);
    }
    expect(MAX_PLANET_BOOST).toBeGreaterThanOrEqual(2.4);
  });
});

describe('clear bodies get an edge overlay (BL-F3-01)', () => {
  it('outlines every glass planet without a shell, and only those', async () => {
    const { needsEdgeOverlay } = await import('./planet-materials');
    const cache = new SystemMaterialCache();
    let outlined = 0;
    for (const node of model.categories) {
      const set = cache.get(node, false);
      node.orbits.forEach((orbit, i) => {
        const wanted = orbit.planet.material === 'glass' && orbit.planet.shell === 'none';
        expect(needsEdgeOverlay(orbit.planet)).toBe(wanted);
        expect(set.planets[i]!.edges !== null, orbit.serviceSlug).toBe(wanted);
        if (wanted) outlined += 1;
      });
    }
    // sales-orders (the BL-F3-01 dart) is one of them.
    expect(outlined).toBeGreaterThan(0);
    cache.dispose();
  });
});

describe('facet edges only on hard-edged shapes (MJ-F4-01)', () => {
  /** Largest angle (degrees) between normals of vertices that share a position. */
  function hardEdgeAngle(shape: keyof typeof PLANET_SHAPES): number {
    const geometry = PLANET_SHAPES[shape].create(1, 1);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const byPosition = new Map<string, Array<[number, number, number]>>();
    for (let i = 0; i < position.count; i++) {
      const key = [position.getX(i), position.getY(i), position.getZ(i)]
        .map((v) => v.toFixed(4))
        .join(',');
      const list = byPosition.get(key) ?? [];
      list.push([normal.getX(i), normal.getY(i), normal.getZ(i)]);
      byPosition.set(key, list);
    }
    let worst = 0;
    for (const normals of byPosition.values()) {
      for (let a = 1; a < normals.length; a++) {
        const [x0, y0, z0] = normals[0]!;
        const [x1, y1, z1] = normals[a]!;
        const cos = Math.min(Math.max(x0 * x1 + y0 * y1 + z0 * z1, -1), 1);
        worst = Math.max(worst, (Math.acos(cos) * 180) / Math.PI);
      }
    }
    geometry.dispose();
    return worst;
  }

  it('marks exactly the hard-edged shapes as faceted', () => {
    for (const shape of Object.keys(PLANET_SHAPES) as Array<keyof typeof PLANET_SHAPES>) {
      const hard = hardEdgeAngle(shape) > 30;
      expect(PLANET_SHAPES[shape].faceted, shape).toBe(hard);
    }
    // The MJ-F4-01 body: a smooth torus never lights up its facet edges.
    expect(PLANET_SHAPES.torus.faceted).toBe(false);
  });

  it('passes the flag to every planet surface and clamps emissive bodies to their accent', async () => {
    const { emissiveFragment } = await import('../shaders/planet-materials');
    const cache = new SystemMaterialCache();
    for (const node of model.categories) {
      const set = cache.get(node, false);
      node.orbits.forEach((orbit, i) => {
        const expected = PLANET_SHAPES[orbit.planet.shape].faceted ? 1 : 0;
        expect(set.planets[i]!.surface.uniforms.uFacetEdges?.value, orbit.serviceSlug).toBe(
          expected,
        );
      });
    }
    cache.dispose();
    expect(emissiveFragment).toContain('facetEdge(s.n, uFacetEdges)');
    expect(emissiveFragment).toContain('min(color, max(uColor, uGlow)');
  });
});
