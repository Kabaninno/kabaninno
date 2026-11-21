import type { CategoryDna, Planet } from '~/content/schema';
import { paths } from '@/lib/routes';
import { MAX_CATEGORY_NODES, MAX_UNIVERSE_NODES, PALETTE, SYSTEM_SCALE } from '../config';
import { CONFIGURATOR_POSITION, PORTFOLIO_POSITION, layoutCategoryNodes } from '../layout';
import { sceneNodeId } from '../node-ids';
import { GOLDEN_ANGLE, degToRad, type OrbitShape } from '../orbit-math';
import type { SceneManifest, Vec3 } from '../types';

/**
 * Render-ready description of the universe, derived purely from the manifest.
 * Every visual element (nodes, orbit previews, links, camera goals) reads from
 * this model, so adding a category or service in `content/` needs no scene code.
 */
export interface UniverseNodeBase {
  /** Position in `nodes` and index into the network shader uniform arrays. */
  index: number;
  /** Highlight id (see node-ids.ts). */
  key: string;
  position: Vec3;
  color: string;
  glow: string;
  /** Locale-less route the node navigates to. */
  path: string;
  /** Localized name for the (aria-hidden) canvas label. */
  label: string;
}

export interface OrbitPreview extends OrbitShape {
  /** Angular speed, rad/s (negative = retrograde). */
  speed: number;
  /** Start angle, radians. */
  phase: number;
  /** Planet radius in world units. */
  size: number;
  /** Planet accent (per-planet DNA tint, else the category colour) and highlight. */
  color: string;
  glow: string;
  serviceSlug: string;
  /** Localized service name (canvas label). */
  label: string;
  /** 1-based position among the category's services (label index "02 / 04"). */
  ordinal: number;
  /** Full planet DNA (shape, material, shell, rings, moons, trail). */
  planet: Planet;
}

export interface CategoryNodeModel extends UniverseNodeBase {
  kind: 'category';
  categoryId: string;
  /** 1-based position among the categories (label index "02 / 05"). */
  ordinal: number;
  core: CategoryDna['core'];
  orbits: OrbitPreview[];
  /** World-space radius enclosing the whole nested system (orbits + rings). */
  systemRadius: number;
}

export interface PortfolioNodeModel extends UniverseNodeBase {
  kind: 'portfolio';
  projectSlugs: string[];
  /** No visible project yet: dimmer cluster and a "coming soon" label (BRIEF B2.3). */
  comingSoon: boolean;
  comingSoonLabel: string;
}

export interface ConfiguratorNodeModel extends UniverseNodeBase {
  kind: 'configurator';
  /** Category accents the beacon blends (selection-driven in M4). */
  palette: string[];
}

export type UniverseNode = CategoryNodeModel | PortfolioNodeModel | ConfiguratorNodeModel;

export interface UniverseLink {
  a: number;
  b: number;
  /** Deterministic 0..1 value used to desynchronize pulses. */
  seed: number;
}

export interface UniverseModel {
  nodes: UniverseNode[];
  categories: CategoryNodeModel[];
  portfolio: PortfolioNodeModel;
  configurator: ConfiguratorNodeModel;
  links: UniverseLink[];
  byKey: ReadonlyMap<string, UniverseNode>;
}

/**
 * Limit: at most MAX_CATEGORY_NODES (30) categories, because the network
 * shader addresses nodes through fixed-size uniform arrays. Exceeding it is a
 * content error: it throws outside production (dev server, tests), and in a
 * production bundle logs an error and renders the first 30 categories.
 */
export function buildUniverseModel(manifest: SceneManifest): UniverseModel {
  const categoryList = limitCategories(manifest.categories);
  const positions = layoutCategoryNodes(
    categoryList.length,
    categoryList.map((category) => category.dna.universePosition),
  );

  const categories: CategoryNodeModel[] = categoryList.map((category, index) => {
    const orbits: OrbitPreview[] = category.services.map((service, serviceIndex) => {
      const { orbit } = service.planet;
      return {
        serviceSlug: service.slug,
        radius: orbit.radius * SYSTEM_SCALE,
        tilt: degToRad(orbit.tilt),
        yaw: serviceIndex * GOLDEN_ANGLE,
        speed: orbit.speed,
        phase: orbit.phase * Math.PI * 2,
        size: service.planet.size * SYSTEM_SCALE,
        color: service.planet.color ?? category.dna.color,
        glow: category.dna.glow,
        label: service.label,
        ordinal: serviceIndex + 1,
        planet: service.planet,
      };
    });
    const systemUnits = category.services.reduce((max, service) => {
      const ringOuter = service.planet.rings.reduce((m, ring) => Math.max(m, ring.outer), 1);
      const moonOuter = service.planet.moons ? service.planet.moons.radius : 1;
      const reach =
        service.planet.orbit.radius + service.planet.size * Math.max(ringOuter, moonOuter);
      return Math.max(max, reach);
    }, 1.5);
    return {
      kind: 'category',
      index,
      key: sceneNodeId.category(category.id),
      categoryId: category.id,
      label: category.label,
      ordinal: index + 1,
      core: category.dna.core,
      position: positions[index]!,
      color: category.dna.color,
      glow: category.dna.glow,
      path: paths.category(category.id),
      orbits,
      systemRadius: systemUnits * SYSTEM_SCALE,
    };
  });

  const portfolio: PortfolioNodeModel = {
    kind: 'portfolio',
    index: categories.length,
    key: sceneNodeId.portfolio,
    position: PORTFOLIO_POSITION,
    color: PALETTE.portfolio,
    glow: PALETTE.portfolioGlow,
    path: paths.portfolio(),
    label: manifest.labels.portfolio,
    projectSlugs: manifest.projects.map((project) => project.slug),
    comingSoon: manifest.projects.length === 0,
    comingSoonLabel: manifest.labels.comingSoon,
  };

  const categoryColors = categories.map((category) => category.color);
  const configurator: ConfiguratorNodeModel = {
    kind: 'configurator',
    index: categories.length + 1,
    key: sceneNodeId.configurator,
    position: CONFIGURATOR_POSITION,
    color: categoryColors[0] ?? PALETTE.beacon,
    glow: PALETTE.beacon,
    path: paths.configurator(),
    label: manifest.labels.configurator,
    palette: categoryColors.length > 0 ? categoryColors : [PALETTE.beacon],
  };

  const nodes: UniverseNode[] = [...categories, portfolio, configurator];
  return {
    nodes,
    categories,
    portfolio,
    configurator,
    links: buildLinks(categories, portfolio, configurator),
    byKey: new Map(nodes.map((node) => [node.key, node])),
  };
}

function limitCategories(categories: SceneManifest['categories']): SceneManifest['categories'] {
  if (categories.length <= MAX_CATEGORY_NODES) return categories;
  const message =
    `[scene] ${categories.length} categories exceed the universe limit of ` +
    `${MAX_CATEGORY_NODES} (MAX_UNIVERSE_NODES = ${MAX_UNIVERSE_NODES} in src/scene/config.ts, ` +
    `minus the portfolio and configurator nodes). Categories after ` +
    `"${categories[MAX_CATEGORY_NODES - 1]!.id}" are not shown in 3D.`;
  if (process.env.NODE_ENV !== 'production') throw new Error(message);
  console.error(message);
  return categories.slice(0, MAX_CATEGORY_NODES);
}

/**
 * Network topology: categories form a ring (neighbors by layout order); the
 * portfolio and configurator anchors connect to their two nearest categories.
 */
function buildLinks(
  categories: readonly CategoryNodeModel[],
  portfolio: PortfolioNodeModel,
  configurator: ConfiguratorNodeModel,
): UniverseLink[] {
  const pairs: Array<[number, number]> = [];
  const count = categories.length;
  if (count === 2) pairs.push([0, 1]);
  if (count >= 3) {
    for (let i = 0; i < count; i++) pairs.push([i, (i + 1) % count]);
  }
  for (const anchor of [portfolio, configurator]) {
    const nearest = [...categories]
      .sort((a, b) => distance(a.position, anchor.position) - distance(b.position, anchor.position))
      .slice(0, 2);
    for (const category of nearest) pairs.push([category.index, anchor.index]);
  }
  return pairs.map(([a, b], i) => ({
    a,
    b,
    seed: fract(Math.sin((i + 1) * 12.9898) * 43758.5453),
  }));
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function fract(value: number): number {
  return value - Math.floor(value);
}
