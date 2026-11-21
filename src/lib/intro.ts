import { locales } from '@/i18n/routing';
import { stripBasePath } from './base-path';
import { safeStorage } from './storage';

/**
 * First-visit intro (BRIEF: ≤ 3 s, skippable, first visit only; D94). The UI
 * decides eligibility (`introEligible` in the scene store) once per page
 * load; the scene plays the intro flight and reports `introActive`; the UI
 * shows "Skip intro" meanwhile and remembers the visit when it ends.
 */

/** localStorage key: `true` once the intro has played or was skipped. */
export const INTRO_STORAGE_KEY = 'kabaninno.intro.v1';

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
  seen: boolean;
  reducedMotion: boolean;
  simple: boolean;
}

export function isIntroEligible({ home, seen, reducedMotion, simple }: IntroConditions): boolean {
  return home && !seen && !reducedMotion && !simple;
}

/** "/kabaninno/pl/" (with the base path) → true; any other route → false. */
export function isLocaleHomePath(pathname: string, basePath?: string): boolean {
  const path = stripBasePath(pathname, basePath);
  if (path === null) return false;
  const match = /^\/([^/]+)\/?$/.exec(path);
  return match !== null && (locales as readonly string[]).includes(match[1]!);
}

export function hasSeenIntro(): boolean {
  return safeStorage.getJSON(INTRO_STORAGE_KEY) === true;
}

export function markIntroSeen(): void {
  safeStorage.setJSON(INTRO_STORAGE_KEY, true);
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn']);

/** Any key skips the intro, except a modifier pressed on its own. */
export function keySkipsIntro(key: string): boolean {
  return !MODIFIER_KEYS.has(key);
}
