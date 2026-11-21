import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAllProjects, getCategories } from '~/content';
import { MAX_CATEGORY_NODES, MAX_UNIVERSE_NODES, SYSTEM_SCALE } from '../config';
import { CONFIGURATOR_POSITION, PORTFOLIO_POSITION, layoutCategoryNodes } from '../layout';
import type { SceneManifest } from '../types';
import { buildUniverseModel } from './model';

function manifestFromContent(): SceneManifest {
  return {
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
    projects: getAllProjects().map((project) => ({
      slug: project.slug,
      label: project.slug,
      categories: [...project.categories],
    })),
  };
}

describe('buildUniverseModel', () => {
  const manifest = manifestFromContent();
  const model = buildUniverseModel(manifest);

  it('creates one node per category plus the portfolio and configurator anchors', () => {
    expect(model.categories).toHaveLength(manifest.categories.length);
    expect(model.nodes).toHaveLength(manifest.categories.length + 2);
    model.nodes.forEach((node, index) => expect(node.index).toBe(index));
    expect(model.portfolio.position).toEqual(PORTFOLIO_POSITION);
    expect(model.configurator.position).toEqual(CONFIGURATOR_POSITION);
  });

  it('places categories with the shared layout and DNA colors', () => {
    const positions = layoutCategoryNodes(manifest.categories.length);
    model.categories.forEach((node, index) => {
      const category = manifest.categories[index]!;
      expect(node.key).toBe(`category:${category.id}`);
      expect(node.color).toBe(category.dna.color);
      expect(node.glow).toBe(category.dna.glow);
      expect(node.position).toEqual(positions[index]);
      expect(node.path).toBe(`/services/${category.id}/`);
    });
  });

  it('respects dna.universePosition overrides', () => {
    const overridden: SceneManifest = {
      ...manifest,
      categories: manifest.categories.map((category, index) =>
        index === 1
          ? { ...category, dna: { ...category.dna, universePosition: [1, 2, 3] } }
          : category,
      ),
    };
    expect(buildUniverseModel(overridden).categories[1]!.position).toEqual([1, 2, 3]);
  });

  it('derives one orbit preview per service at system scale', () => {
    model.categories.forEach((node, index) => {
      const services = manifest.categories[index]!.services;
      expect(node.orbits).toHaveLength(services.length);
      node.orbits.forEach((orbit, serviceIndex) => {
        const planet = services[serviceIndex]!.planet;
        expect(orbit.serviceSlug).toBe(services[serviceIndex]!.slug);
        expect(orbit.radius).toBeCloseTo(planet.orbit.radius * SYSTEM_SCALE);
        expect(orbit.speed).toBe(planet.orbit.speed);
      });
      const maxOrbit = Math.max(...node.orbits.map((orbit) => orbit.radius));
      expect(node.systemRadius).toBeGreaterThanOrEqual(maxOrbit);
    });
  });

  it('builds a valid network: ring of categories plus two links per anchor', () => {
    const count = manifest.categories.length;
    expect(model.links).toHaveLength(count + 4);
    for (const link of model.links) {
      expect(link.a).not.toBe(link.b);
      expect(model.nodes[link.a]).toBeDefined();
      expect(model.nodes[link.b]).toBeDefined();
      expect(link.seed).toBeGreaterThanOrEqual(0);
      expect(link.seed).toBeLessThan(1);
    }
  });

  it('is deterministic and indexes nodes by highlight key', () => {
    expect(buildUniverseModel(manifest).links).toEqual(model.links);
    expect(model.byKey.get('portfolio')).toBe(model.portfolio);
    expect(model.byKey.get('configurator')).toBe(model.configurator);
    expect(model.byKey.get(model.categories[0]!.key)).toBe(model.categories[0]);
  });

  describe('category limit (shader uniform arrays)', () => {
    const withCategories = (count: number): SceneManifest => ({
      ...manifest,
      categories: Array.from({ length: count }, (_, i) => ({
        ...manifest.categories[0]!,
        id: `cat-${i}`,
      })),
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('keeps the real content within the documented limit', () => {
      expect(MAX_CATEGORY_NODES).toBe(MAX_UNIVERSE_NODES - 2);
      expect(manifest.categories.length).toBeLessThanOrEqual(MAX_CATEGORY_NODES);
    });

    it('supports exactly the limit, filling every node slot', () => {
      const full = buildUniverseModel(withCategories(MAX_CATEGORY_NODES));
      expect(full.categories).toHaveLength(MAX_CATEGORY_NODES);
      expect(full.nodes).toHaveLength(MAX_UNIVERSE_NODES);
    });

    it('throws a clear error outside production instead of dropping categories', () => {
      expect(() => buildUniverseModel(withCategories(MAX_CATEGORY_NODES + 1))).toThrow(
        /31 categories exceed the universe limit of 30/,
      );
    });

    it('logs and renders the first categories in a production bundle', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const capped = buildUniverseModel(withCategories(MAX_UNIVERSE_NODES + 5));
      expect(capped.categories).toHaveLength(MAX_CATEGORY_NODES);
      expect(capped.nodes).toHaveLength(MAX_UNIVERSE_NODES);
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]![0])).toMatch(/after "cat-29" are not shown/);
    });
  });
});
