import { locales } from '@/i18n/routing';
import { stripBasePath } from './base-path';
import { safeStorage } from './storage';

/**
 * Intro flight (BRIEF: ≤ 3 s, skippable; D94, D140). The UI decides
 * eligibility (`introEligible` in the scene store) once per page load: every
 * fresh load of a locale home, never a client-side navigation. The scene
 * plays the flight from a system's core out to the whole universe and reports
 * `introActive`; the UI shows "Skip intro" meanwhile, and any touch, click,
 * scroll or key ends it at once.
 */

/**
 * localStorage key that switches the intro off when it holds `true`. The site
 * never writes it (the intro is not "first visit only" any more, D140); it is
 * a manual / automation opt-out (e2e and screenshot runs set it). The earlier
 * `kabaninno.intro.v1` ("seen") flag is ignored on purpose, so returning
 * visitors see the new intro too.
 */
export const INTRO_OPT_OUT_KEY = 'kabaninno.intro.v2';

/** Attribute on `<html>` while the intro plays (hides `[data-intro-hide]`, globals.css). */
export const INTRO_ACTIVE_ATTRIBUTE = 'data-intro-active';

/**
 * Safety cap: the hero comes back and the skip button goes away even if the
 * scene never reports the end (the intro itself is ≤ 3 s; software GL can
 * stretch it a little).
 */
export const INTRO_MAX_MS = 4500;

export interface IntroConditions {
  /** The page was loaded on a locale home ("/pl/", "/en/", "/uk/"). */
  home: boolean;
  /** The opt-out key is set (automation, manual). */
  optedOut: boolean;
  reducedMotion: boolean;
  simple: boolean;
}

export function isIntroEligible({
  home,
  optedOut,
  reducedMotion,
  simple,
}: IntroConditions): boolean {
  return home && !optedOut && !reducedMotion && !simple;
}

/** "/kabaninno/pl/" (with the base path) → true; any other route → false. */
export function isLocaleHomePath(pathname: string, basePath?: string): boolean {
  const path = stripBasePath(pathname, basePath);
  if (path === null) return false;
  const match = /^\/([^/]+)\/?$/.exec(path);
  return match !== null && (locales as readonly string[]).includes(match[1]!);
}

export function isIntroOptedOut(): boolean {
  return safeStorage.getJSON(INTRO_OPT_OUT_KEY) === true;
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn']);

/** Any key skips the intro, except a modifier pressed on its own. */
export function keySkipsIntro(key: string): boolean {
  return !MODIFIER_KEYS.has(key);
}
