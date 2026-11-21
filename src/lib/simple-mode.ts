import { safeStorage } from './storage';
import { isWebGLAvailable } from './webgl';

/**
 * Simple (2D) mode (BRIEF «Простий режим», D94, D115): the same content
 * without the 3D layer.
 *
 * Rule (`resolveSimpleMode`, mirrored by the inline head script):
 * 1. Forced when 3D cannot run: no WebGL 2 API, or this browser failed to
 *    create a WebGL context recently (the scene gave up; marker below).
 * 2. Otherwise the visitor's explicit choice (HUD switch) wins.
 * 3. Without a choice: simple on strong low-end hints (≤ 2 GB device memory,
 *    ≤ 2 CPU cores, or Data Saver), 3D everywhere else.
 *
 * The decision is made before the first paint by a tiny inline script in the
 * locale layout (`simpleModeBootScript`), which sets `html[data-simple]`; the
 * UI then mirrors it into the scene store (`simpleMode`), keeps the attribute
 * in sync with the store, and CSS shows the static cosmos backdrop while the
 * attribute is present, so nothing flashes.
 */

/** localStorage key of the visitor's explicit choice (JSON boolean); versioned. */
export const SIMPLE_MODE_STORAGE_KEY = 'kabaninno.simpleMode.v1';

/**
 * localStorage key of the "WebGL failed here" marker: `{ ua, at }`. Written
 * when the scene could not create a context although the API exists
 * (blocklisted GPU, WebGL disabled: Chrome still defines the API, D55,
 * A-F3-04), so later page loads decide before the first paint and skip the
 * scene download. Valid for the same User-Agent (a browser update retries)
 * and at most `WEBGL_FAILED_TTL_MS`.
 */
export const WEBGL_FAILED_STORAGE_KEY = 'kabaninno.webglFailed.v1';
export const WEBGL_FAILED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Attribute on `<html>` while simple mode is on. */
export const SIMPLE_MODE_ATTRIBUTE = 'data-simple';

/** A stored preference: `true` / `false` as chosen, anything else means "no choice". */
export function parseSimplePreference(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export interface DeviceHints {
  /** `navigator.deviceMemory` in GB (Chromium only). */
  deviceMemory?: number;
  /** `navigator.hardwareConcurrency`. */
  hardwareConcurrency?: number;
  /** `navigator.connection.saveData` (Data Saver / Lite mode). */
  saveData?: boolean;
}

/** Strong low-end hints (D115). Missing or zero values never count. */
export function isLowEndDevice({
  deviceMemory,
  hardwareConcurrency,
  saveData,
}: DeviceHints): boolean {
  return (
    (typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory <= 2) ||
    (typeof hardwareConcurrency === 'number' &&
      hardwareConcurrency > 0 &&
      hardwareConcurrency <= 2) ||
    saveData === true
  );
}

/** Is a stored failure marker still valid for this browser? */
export function isWebglFailureMarker(value: unknown, userAgent: string, now: number): boolean {
  if (!value || typeof value !== 'object') return false;
  const { ua, at } = value as { ua?: unknown; at?: unknown };
  return (
    ua === userAgent && typeof at === 'number' && now - at >= 0 && now - at < WEBGL_FAILED_TTL_MS
  );
}

export interface SimpleModeInputs {
  /** The visitor's explicit choice, or null. */
  preference: boolean | null;
  /** The browser exposes the WebGL 2 API. */
  webgl2: boolean;
  /** A valid "WebGL failed here" marker exists (or the scene just failed). */
  webglFailed: boolean;
  /** `isLowEndDevice(...)`. */
  lowEnd: boolean;
}

/** 3D cannot run at all: simple mode is forced and the switch is disabled. */
export function isSimpleModeForced({
  webgl2,
  webglFailed,
}: Pick<SimpleModeInputs, 'webgl2' | 'webglFailed'>): boolean {
  return !webgl2 || webglFailed;
}

export function resolveSimpleMode(inputs: SimpleModeInputs): boolean {
  if (isSimpleModeForced(inputs)) return true;
  if (inputs.preference !== null) return inputs.preference;
  return inputs.lowEnd;
}

export function readSimplePreference(): boolean | null {
  return safeStorage.getJSON(SIMPLE_MODE_STORAGE_KEY, parseSimplePreference);
}

export function writeSimplePreference(simple: boolean): void {
  safeStorage.setJSON(SIMPLE_MODE_STORAGE_KEY, simple);
}

/** This browser has a valid "WebGL failed here" marker (client only). */
export function hasWebglFailed(): boolean {
  return isWebglFailureMarker(
    safeStorage.getJSON(WEBGL_FAILED_STORAGE_KEY),
    navigator.userAgent,
    Date.now(),
  );
}

export function markWebglFailed(): void {
  safeStorage.setJSON(WEBGL_FAILED_STORAGE_KEY, { ua: navigator.userAgent, at: Date.now() });
}

/** Low-end hints of this device (client only). */
export function currentDeviceHints(): DeviceHints {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData,
  };
}

/** All inputs of the rule for this browser right now (client only). */
export function currentSimpleModeInputs(): SimpleModeInputs {
  return {
    preference: readSimplePreference(),
    webgl2: isWebGLAvailable(),
    webglFailed: hasWebglFailed(),
    lowEnd: isLowEndDevice(currentDeviceHints()),
  };
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
 * storage) count as "no choice" / "no marker". Unit tests run it against the
 * pure function for every combination. Kept small: it is inlined into every
 * page.
 */
export function simpleModeBootScript(): string {
  const key = JSON.stringify(SIMPLE_MODE_STORAGE_KEY);
  const failedKey = JSON.stringify(WEBGL_FAILED_STORAGE_KEY);
  const attribute = JSON.stringify(SIMPLE_MODE_ATTRIBUTE);
  return (
    '(function(){try{' +
    'var n=navigator,s=null,p=null,f=null,t=Date.now();' +
    'try{s=localStorage}catch(e){}' +
    `try{p=JSON.parse(s.getItem(${key}))}catch(e){}` +
    `try{f=JSON.parse(s.getItem(${failedKey}))}catch(e){}` +
    'var m=n.deviceMemory,h=n.hardwareConcurrency,c=n.connection;' +
    'var low=(m>0&&m<=2)||(h>0&&h<=2)||!!(c&&c.saveData===true);' +
    `var bad=!!(f&&f.ua===n.userAgent&&typeof f.at==="number"&&t-f.at>=0&&t-f.at<${WEBGL_FAILED_TTL_MS});` +
    'var on=typeof WebGL2RenderingContext==="undefined"||bad||(typeof p==="boolean"?p:low);' +
    `if(on)document.documentElement.setAttribute(${attribute},"")` +
    '}catch(e){}})()'
  );
}
