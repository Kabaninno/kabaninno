import { safeStorage } from './storage';
import { isWebGLAvailable } from './webgl';

/**
 * Simple (2D) mode (BRIEF «Простий режим», D94): the same content without the
 * 3D layer. On by the visitor's choice (HUD switch), and automatically when
 * the browser has no WebGL 2 API (the scene could not run at all).
 *
 * The decision is made before the first paint by a tiny inline script in the
 * locale layout (`simpleModeBootScript`), which sets `html[data-simple]`; the
 * UI then mirrors it into the scene store (`simpleMode`), keeps the attribute
 * in sync with the store, and CSS shows the static cosmos backdrop while the
 * attribute is present — so nothing flashes.
 */

/** localStorage key of the visitor's explicit choice (JSON boolean); versioned. */
export const SIMPLE_MODE_STORAGE_KEY = 'kabaninno.simpleMode.v1';

/** Attribute on `<html>` while simple mode is on. */
export const SIMPLE_MODE_ATTRIBUTE = 'data-simple';

/** A stored preference: `true` / `false` as chosen, anything else means "no choice". */
export function parseSimplePreference(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * Without the WebGL 2 API the 3D layer cannot run, so simple mode is forced;
 * otherwise only an explicit "on" enables it (3D is the default experience).
 */
export function resolveSimpleMode(preference: boolean | null, webgl2: boolean): boolean {
  return !webgl2 || preference === true;
}

export function readSimplePreference(): boolean | null {
  return safeStorage.getJSON(SIMPLE_MODE_STORAGE_KEY, parseSimplePreference);
}

export function writeSimplePreference(simple: boolean): void {
  safeStorage.setJSON(SIMPLE_MODE_STORAGE_KEY, simple);
}

/** The mode for this browser right now (client only): stored choice + API check. */
export function currentSimpleMode(): boolean {
  return resolveSimpleMode(readSimplePreference(), isWebGLAvailable());
}

export function applySimpleAttribute(
  simple: boolean,
  root: Pick<Element, 'setAttribute' | 'removeAttribute'> = document.documentElement,
): void {
  if (simple) root.setAttribute(SIMPLE_MODE_ATTRIBUTE, '');
  else root.removeAttribute(SIMPLE_MODE_ATTRIBUTE);
}

/**
 * Source of the blocking inline script in `<head>` (runs while the HTML is
 * parsed, before the first paint). Same rule as `resolveSimpleMode`, written
 * as ES5 without dependencies; storage failures (private mode, blocked
 * storage) count as "no choice". Must stay tiny: it is inlined into every page.
 */
export function simpleModeBootScript(
  key: string = SIMPLE_MODE_STORAGE_KEY,
  attribute: string = SIMPLE_MODE_ATTRIBUTE,
): string {
  return (
    '(function(){try{var p=null;' +
    `try{p=JSON.parse(localStorage.getItem(${JSON.stringify(key)}))}catch(e){}` +
    'if(typeof WebGL2RenderingContext==="undefined"||p===true)' +
    `document.documentElement.setAttribute(${JSON.stringify(attribute)},"")` +
    '}catch(e){}})()'
  );
}
