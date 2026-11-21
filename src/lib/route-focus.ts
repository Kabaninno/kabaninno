import { routeToSceneState, sceneStateToPath, type SceneTarget } from './route-state';
import { paths } from './routes';

/**
 * Where keyboard focus goes after a client-side route change (a11y A-01).
 * The activated link usually unmounts with the old route, which would leave
 * focus on <body>. Pure logic; the DOM side lives in
 * `components/layout/RouteFocus.tsx`.
 *
 * - Going up (Esc, Back, breadcrumb: the new route is an ancestor of the old
 *   one): focus returns to the link that leads back down to where the user
 *   was, e.g. the home index link of the system just left, or the planet link
 *   in its system panel. Only after keyboard input: for a mouse user that
 *   focus would light the node up in the scene.
 * - Any other change: focus moves to the new page's heading (programmatic,
 *   so no ring after a mouse click; `:focus-visible` decides).
 */
export type FocusPlan =
  | { type: 'none' }
  | { type: 'heading' }
  /**
   * Candidate hrefs (locale-less paths), most specific first; `fallback` when
   * none of them is on the page (e.g. hidden on short viewports).
   */
  | { type: 'link'; paths: string[]; fallback: 'heading' | 'none' };

/** Ancestors of a scene target, nearest first (planet → system → universe). */
function ancestors(target: SceneTarget): SceneTarget[] {
  switch (target.mode) {
    case 'planet':
      return [{ mode: 'system', category: target.category }, { mode: 'universe' }];
    case 'project':
      return [{ mode: 'portfolio' }, { mode: 'universe' }];
    case 'system':
    case 'portfolio':
    case 'configurator':
      return [{ mode: 'universe' }];
    default:
      return [];
  }
}

/** Paths that lead back toward `from`, deepest first (planet, then its system). */
function pathsTowards(from: SceneTarget): string[] {
  switch (from.mode) {
    case 'planet':
      return [paths.service(from.category, from.service), paths.category(from.category)];
    case 'project':
      return [paths.project(from.project), paths.portfolio()];
    case 'universe':
    case 'unknown':
      return [];
    default:
      return [sceneStateToPath(from)];
  }
}

/**
 * @param previous locale-less pathname before the change
 * @param current  locale-less pathname after the change
 * @param keyboard the last input before the change was a key press
 */
export function routeFocusPlan(previous: string, current: string, keyboard: boolean): FocusPlan {
  const from = routeToSceneState(previous);
  const to = routeToSceneState(current);
  const toPath = sceneStateToPath(to);
  if (to.mode === 'unknown' || toPath === sceneStateToPath(from)) return { type: 'none' };
  const goingUp = ancestors(from).some((ancestor) => sceneStateToPath(ancestor) === toPath);
  if (goingUp) {
    if (!keyboard) return to.mode === 'universe' ? { type: 'none' } : { type: 'heading' };
    return {
      type: 'link',
      paths: pathsTowards(from),
      fallback: to.mode === 'universe' ? 'none' : 'heading',
    };
  }
  return to.mode === 'universe' ? { type: 'none' } : { type: 'heading' };
}
