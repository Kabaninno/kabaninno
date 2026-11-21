import { locales } from '@/i18n/routing';
import { paths } from './routes';

/**
 * The 3D scene is a state machine driven by the URL:
 * universe → system (category) → planet (service), plus portfolio,
 * project and configurator views. The URL is the single source of truth;
 * the scene never keeps its own copy of "where we are".
 */
export type SceneTarget =
  | { mode: 'universe' }
  | { mode: 'system'; category: string }
  | { mode: 'planet'; category: string; service: string }
  | { mode: 'portfolio' }
  | { mode: 'project'; project: string }
  | { mode: 'configurator' }
  | { mode: 'unknown' };

export type SceneMode = SceneTarget['mode'];

/**
 * Maps a pathname to a scene target. Accepts paths with or without a locale
 * prefix and with or without a trailing slash. The base path must already be
 * stripped (Next.js `usePathname` does that).
 */
export function routeToSceneState(pathname: string): SceneTarget {
  const segments = pathname.split(/[?#]/)[0]!.split('/').filter(Boolean).map(decodeSegment);

  if (segments.length > 0 && (locales as readonly string[]).includes(segments[0]!)) {
    segments.shift();
  }

  const [first, second, third, ...rest] = segments;
  if (rest.length > 0) return { mode: 'unknown' };

  if (first === undefined) return { mode: 'universe' };

  if (first === 'services') {
    if (second === undefined) return { mode: 'universe' };
    if (third === undefined) return { mode: 'system', category: second };
    return { mode: 'planet', category: second, service: third };
  }

  if (first === 'portfolio') {
    if (third !== undefined) return { mode: 'unknown' };
    if (second === undefined) return { mode: 'portfolio' };
    return { mode: 'project', project: second };
  }

  if (first === 'configurator' && second === undefined) return { mode: 'configurator' };

  return { mode: 'unknown' };
}

/** Percent-decodes a path segment; malformed escapes (e.g. "%E0") stay raw instead of throwing. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Inverse of `routeToSceneState` (locale-less path). */
export function sceneStateToPath(target: SceneTarget): string {
  switch (target.mode) {
    case 'universe':
    case 'unknown':
      return paths.home();
    case 'system':
      return paths.category(target.category);
    case 'planet':
      return paths.service(target.category, target.service);
    case 'portfolio':
      return paths.portfolio();
    case 'project':
      return paths.project(target.project);
    case 'configurator':
      return paths.configurator();
  }
}

/** Where "back" (Esc, "← Universe") leads from a given state. */
export function parentSceneState(target: SceneTarget): SceneTarget {
  switch (target.mode) {
    case 'planet':
      return { mode: 'system', category: target.category };
    case 'project':
      return { mode: 'portfolio' };
    default:
      return { mode: 'universe' };
  }
}
