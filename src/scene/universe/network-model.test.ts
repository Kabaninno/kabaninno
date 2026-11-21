import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { QUALITY_PRESETS } from '../quality';
import type { SceneManifest, Vec3 } from '../types';
import { buildUniverseModel } from './model';
import { MAX_MINOR_NODES, buildNetwork, clearRadius, generateMinorNodes } from './network-model';

function manifestFor(categoryIds?: string[]): SceneManifest {
  const categories = getCategories().filter((c) => !categoryIds || categoryIds.includes(c.id));
  return {
    labels: { portfolio: 'Portfolio', configurator: 'Configurator', comingSoon: 'Coming soon' },
    categories: categories.map((category) => ({
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
}

const model = buildUniverseModel(manifestFor());
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('generateMinorNodes', () => {
  it('is deterministic and produces the full set', () => {
    const a = generateMinorNodes(model);
    const b = generateMinorNodes(buildUniverseModel(manifestFor()));
    expect(a).toHaveLength(MAX_MINOR_NODES);
    expect(a).toEqual(b);
  });

  it('keeps minor nodes off every main node core, halo and orbit preview', () => {
    for (const node of generateMinorNodes(model)) {
      for (const main of model.nodes) {
        expect(dist(node.position, main.position)).toBeGreaterThanOrEqual(clearRadius(main) - 1e-3);
      }
      expect(node.size).toBeGreaterThan(0);
      expect(node.brightness).toBeGreaterThan(0);
      expect(node.brightness).toBeLessThanOrEqual(1);
      expect(node.anchor).toBeGreaterThanOrEqual(0);
      expect(node.anchor).toBeLessThan(model.nodes.length);
    }
  });

  it('reshapes with the content (data-driven)', () => {
    const fewer = buildUniverseModel(manifestFor(['web', 'crm', 'ai']));
    expect(generateMinorNodes(fewer)).not.toEqual(generateMinorNodes(model));
  });
});

describe('buildNetwork', () => {
  it('renders a prefix of the same node set per quality tier', () => {
    const full = generateMinorNodes(model);
    for (const preset of Object.values(QUALITY_PRESETS)) {
      const network = buildNetwork(model, preset.minorNodes);
      expect(network.minor).toEqual(full.slice(0, preset.minorNodes));
    }
  });

  it('builds valid, unique links of every kind', () => {
    const network = buildNetwork(model, QUALITY_PRESETS.high.minorNodes);
    const keys = new Set<string>();
    const degree = new Map<number, number>();
    for (const link of network.links) {
      for (const end of [link.a, link.b]) {
        const limit = end.kind === 'main' ? model.nodes.length : network.minor.length;
        expect(end.index).toBeGreaterThanOrEqual(0);
        expect(end.index).toBeLessThan(limit);
        if (end.kind === 'minor') degree.set(end.index, (degree.get(end.index) ?? 0) + 1);
      }
      const key = [`${link.a.kind}${link.a.index}`, `${link.b.kind}${link.b.index}`]
        .sort()
        .join('-');
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      expect(`${link.a.kind}${link.a.index}`).not.toBe(`${link.b.kind}${link.b.index}`);
      expect(link.seed).toBeGreaterThanOrEqual(0);
      expect(link.seed).toBeLessThan(1);
    }
    const kinds = new Set(network.links.map((link) => link.kind));
    expect(kinds).toEqual(new Set(['main', 'dendrite', 'minor']));
    expect(network.links.filter((link) => link.kind === 'main')).toHaveLength(model.links.length);
    // Every main node gets dendrites; the minor web stays sparse.
    for (const main of model.nodes) {
      const dendrites = network.links.filter(
        (link) => link.kind === 'dendrite' && link.b.kind === 'main' && link.b.index === main.index,
      );
      expect(dendrites.length).toBeGreaterThanOrEqual(2);
    }
    for (const count of degree.values()) expect(count).toBeLessThanOrEqual(5 + 4);
  });

  it('handles an empty tier', () => {
    const network = buildNetwork(model, 0);
    expect(network.minor).toHaveLength(0);
    expect(network.links.every((link) => link.kind === 'main')).toBe(true);
  });
});
