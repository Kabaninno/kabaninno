import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { CONFIGURATOR_POSITION, PORTFOLIO_POSITION, layoutCategoryNodes } from '@/scene/layout';
import { sceneNodeId } from '@/scene/node-ids';
import {
  MAX_IMPULSES,
  buildSystemMap,
  linesOf,
  litNodeIndex,
  percentOf,
  universeMapFrom,
  type MapNodeKind,
} from './simple-map';
import { buildConstellation } from './simple-sky';

const categories = getCategories();
const positions = layoutCategoryNodes(
  categories.length,
  categories.map((category) => category.dna.universePosition),
);
const sky = buildConstellation({
  categories: categories.map((category, index) => ({
    id: category.id,
    color: category.dna.color,
    position: positions[index]!,
  })),
  portfolio: { color: '#DDE6FF', position: PORTFOLIO_POSITION },
  configurator: { color: '#4FF0D2', position: CONFIGURATOR_POSITION },
});
const describeNode = (id: string, kind: MapNodeKind) => {
  if (kind === 'portfolio')
    return { key: sceneNodeId.portfolio, label: 'Portfolio', path: '/portfolio/' };
  if (kind === 'configurator') {
    return { key: sceneNodeId.configurator, label: 'Konfigurator', path: '/configurator/' };
  }
  return { key: sceneNodeId.category(id), label: id, path: `/services/${id}/` };
};
const universe = universeMapFrom(sky, describeNode);

describe('universe map (data-driven)', () => {
  it('has every system, the portfolio and the configurator as linked nodes', () => {
    expect(universe.nodes.map((node) => node.key)).toEqual([
      ...categories.map((category) => sceneNodeId.category(category.id)),
      sceneNodeId.portfolio,
      sceneNodeId.configurator,
    ]);
    for (const node of universe.nodes) {
      expect(node.path.startsWith('/')).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(universe.width);
    }
  });

  it('keeps the constellation lines and adds a few impulses along them', () => {
    expect(universe.links).toEqual(sky.links);
    expect(universe.impulses.length).toBeGreaterThan(0);
    expect(universe.impulses.length).toBeLessThanOrEqual(MAX_IMPULSES);
    for (const impulse of universe.impulses) expect(universe.links).toContainEqual(impulse);
  });
});

describe('system map', () => {
  const category = categories[0]!;
  const view = buildSystemMap({
    key: sceneNodeId.category(category.id),
    label: category.id,
    path: `/services/${category.id}/`,
    color: category.dna.color,
    planets: category.services.map((service) => ({
      key: sceneNodeId.service(category.id, service.slug),
      label: service.slug,
      path: `/services/${category.id}/${service.slug}/`,
      color: service.planet.color ?? category.dna.color,
      orbit: service.planet.orbit,
    })),
  });

  it('puts the core in the centre and every planet on its own orbit', () => {
    const [core, ...planets] = view.nodes;
    expect(core).toMatchObject({ kind: 'core', x: view.center!.x, y: view.center!.y });
    expect(planets).toHaveLength(category.services.length);
    expect(view.orbits).toHaveLength(category.services.length);
    planets.forEach((planet, index) => {
      const { rx, ry } = view.orbits[index]!;
      const dx = (planet.x - view.center!.x) / rx;
      const dy = (planet.y - view.center!.y) / ry;
      expect(Math.hypot(dx, dy)).toBeCloseTo(1, 1);
      expect(planet.x).toBeGreaterThanOrEqual(0);
      expect(planet.x).toBeLessThanOrEqual(view.width);
      expect(planet.y).toBeGreaterThanOrEqual(0);
      expect(planet.y).toBeLessThanOrEqual(view.height);
    });
  });

  it('sends impulses from the core to planets', () => {
    expect(view.impulses.every(([from]) => from === 0)).toBe(true);
    expect(view.impulses.length).toBe(Math.min(MAX_IMPULSES, category.services.length));
  });
});

describe('highlight mapping (two-way with the HTML lists)', () => {
  it('lights the node of a highlight id, mapping services and cases to their universe node', () => {
    const web = categories[0]!;
    const webIndex = universe.nodes.findIndex((node) => node.key === sceneNodeId.category(web.id));
    expect(litNodeIndex(universe, sceneNodeId.category(web.id))).toBe(webIndex);
    expect(litNodeIndex(universe, sceneNodeId.service(web.id, web.services[0]!.slug))).toBe(
      webIndex,
    );
    expect(litNodeIndex(universe, sceneNodeId.project('any-case'))).toBe(
      universe.nodes.findIndex((node) => node.key === sceneNodeId.portfolio),
    );
    expect(litNodeIndex(universe, null)).toBe(-1);
    expect(litNodeIndex(universe, 'unknown')).toBe(-1);
  });

  it('lights exactly the lines touching the node', () => {
    const lines = linesOf(universe, 0);
    expect(lines.length).toBeGreaterThan(0);
    for (const index of lines) expect(universe.links[index]).toContain(0);
    expect(linesOf(universe, -1)).toEqual([]);
  });

  it('places links in percent of the map box', () => {
    expect(percentOf(universe, universe.width / 2, universe.height)).toEqual({
      left: '50%',
      top: '100%',
    });
  });
});
