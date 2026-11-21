import { getCategories } from '~/content';
import type { Locale } from '@/i18n/routing';
import { getMessagesFor } from '@/i18n/messages';
import { PALETTE } from '@/scene/config';
import { CONFIGURATOR_POSITION, PORTFOLIO_POSITION, layoutCategoryNodes } from '@/scene/layout';
import { sceneNodeId } from '@/scene/node-ids';
import { getCategoryText, getServiceText } from './content-text';
import { fillTemplate } from './portfolio';
import { paths } from './routes';
import { buildConstellation } from './simple-sky';
import { buildSystemMap, universeMapFrom, type MapView } from './simple-map';

export interface SimpleMapData {
  /** Accessible name of the universe map's navigation. */
  universeLabel: string;
  universe: MapView;
  /** Per category id: its system map and accessible name. */
  systems: Record<string, { label: string; view: MapView }>;
}

/**
 * Server only: the simple-mode maps for a locale, from content (categories,
 * services, planet DNA) and the same layout function as the 3D universe.
 * Nothing is hard-coded: a new category or service appears on the maps.
 */
export function buildSimpleMapData(locale: Locale): SimpleMapData {
  const ui = getMessagesFor(locale);
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
    portfolio: { color: PALETTE.portfolio, position: PORTFOLIO_POSITION },
    configurator: { color: 'var(--color-brand)', position: CONFIGURATOR_POSITION },
  });

  const universe = universeMapFrom(sky, (id, kind) => {
    if (kind === 'portfolio') {
      return { key: sceneNodeId.portfolio, label: ui.hud.portfolio, path: paths.portfolio() };
    }
    if (kind === 'configurator') {
      return {
        key: sceneNodeId.configurator,
        label: ui.hud.configurator,
        path: paths.configurator(),
      };
    }
    return {
      key: sceneNodeId.category(id),
      label: getCategoryText(locale, id).name,
      path: paths.category(id),
    };
  });

  const systems = Object.fromEntries(
    categories.map((category) => {
      const name = getCategoryText(locale, category.id).name;
      const view = buildSystemMap({
        key: sceneNodeId.category(category.id),
        label: name,
        path: paths.category(category.id),
        color: category.dna.color,
        planets: category.services.map((service) => ({
          key: sceneNodeId.service(category.id, service.slug),
          label: getServiceText(locale, category.id, service.slug).title,
          path: paths.service(category.id, service.slug),
          color: service.planet.color ?? category.dna.color,
          orbit: service.planet.orbit,
        })),
      });
      return [category.id, { label: fillTemplate(ui.hud.systemMap, { name }), view }];
    }),
  );

  return { universeLabel: ui.hud.universeMap, universe, systems };
}
