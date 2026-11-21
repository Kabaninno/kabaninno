import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { CONFIGURATOR_POSITION, PORTFOLIO_POSITION, layoutCategoryNodes } from '@/scene/layout';
import { SIMPLE_SKY_TILES, buildConstellation } from './simple-sky';
import { starTileSvg } from './starfield';

const categories = getCategories();
const positions = layoutCategoryNodes(
  categories.length,
  categories.map((category) => category.dna.universePosition),
);
const input = {
  categories: categories.map((category, index) => ({
    id: category.id,
    color: category.dna.color,
    position: positions[index]!,
  })),
  portfolio: { color: '#DDE6FF', position: PORTFOLIO_POSITION },
  configurator: { color: '#F1EEFF', position: CONFIGURATOR_POSITION },
};

describe('buildConstellation', () => {
  const sky = buildConstellation(input);

  it('has one node per universe node, all inside the viewBox', () => {
    expect(sky.nodes).toHaveLength(categories.length + 2);
    for (const node of sky.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(sky.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(sky.height);
      expect(node.r).toBeGreaterThan(0);
    }
    expect(sky.height).toBeGreaterThan(100);
  });

  it('keeps category colours and order (data-driven)', () => {
    expect(sky.nodes.slice(0, categories.length).map((node) => node.color)).toEqual(
      categories.map((category) => category.dna.color),
    );
    expect(sky.nodes.at(-2)?.kind).toBe('portfolio');
    expect(sky.nodes.at(-1)?.kind).toBe('configurator');
  });

  it('links the category ring plus two links each for portfolio and configurator', () => {
    expect(sky.links).toHaveLength(categories.length + 4);
    const keys = sky.links.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`));
    expect(new Set(keys).size).toBe(keys.length);
    for (const [a, b] of sky.links) {
      expect(a).not.toBe(b);
      expect(sky.nodes[a]).toBeDefined();
      expect(sky.nodes[b]).toBeDefined();
    }
  });

  it('is deterministic and copes with a single category', () => {
    expect(buildConstellation(input)).toEqual(sky);
    const single = buildConstellation({ ...input, categories: input.categories.slice(0, 1) });
    expect(single.nodes).toHaveLength(3);
    expect(single.links).toHaveLength(2);
  });
});

/*
 * The star tiles in public/sky/ are generated from SIMPLE_SKY_TILES: this
 * file snapshot writes them on the first run and fails when they drift
 * (regenerate with `npm test -- -u`).
 */
describe('simple-mode star tiles', () => {
  for (const tile of SIMPLE_SKY_TILES) {
    it(`${tile.file} matches its options`, async () => {
      const svg = starTileSvg(tile);
      expect(svg.length).toBeLessThan(12_000);
      await expect(svg).toMatchFileSnapshot(`../../public${tile.file}`);
    });
  }
});
