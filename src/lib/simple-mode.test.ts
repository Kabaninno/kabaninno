import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  SIMPLE_MODE_ATTRIBUTE,
  SIMPLE_MODE_STORAGE_KEY,
  WEBGL_FAILED_STORAGE_KEY,
  WEBGL_FAILED_TTL_MS,
  applySimpleAttribute,
  isLowEndDevice,
  isSimpleModeForced,
  isWebglFailureMarker,
  parseSimplePreference,
  resolveSimpleMode,
  simpleModeBootScript,
  type DeviceHints,
} from './simple-mode';

const UA = 'Mozilla/5.0 (test) Chrome/157';
const NOW = 1_800_000_000_000;

describe('parseSimplePreference', () => {
  it('accepts booleans only', () => {
    expect(parseSimplePreference(true)).toBe(true);
    expect(parseSimplePreference(false)).toBe(false);
    expect(parseSimplePreference('true')).toBeNull();
    expect(parseSimplePreference(1)).toBeNull();
    expect(parseSimplePreference(null)).toBeNull();
    expect(parseSimplePreference({ simple: true })).toBeNull();
  });
});

describe('isLowEndDevice (D115)', () => {
  it('flags ≤ 2 GB memory, ≤ 2 cores or Data Saver', () => {
    expect(isLowEndDevice({ deviceMemory: 2 })).toBe(true);
    expect(isLowEndDevice({ deviceMemory: 0.5 })).toBe(true);
    expect(isLowEndDevice({ hardwareConcurrency: 2 })).toBe(true);
    expect(isLowEndDevice({ saveData: true })).toBe(true);
  });

  it('ignores missing, zero and ordinary values', () => {
    expect(isLowEndDevice({})).toBe(false);
    expect(isLowEndDevice({ deviceMemory: 4, hardwareConcurrency: 8, saveData: false })).toBe(
      false,
    );
    expect(isLowEndDevice({ deviceMemory: 0, hardwareConcurrency: 0 })).toBe(false);
  });
});

describe('isWebglFailureMarker', () => {
  it('is valid for the same browser within the TTL', () => {
    expect(isWebglFailureMarker({ ua: UA, at: NOW - 1000 }, UA, NOW)).toBe(true);
  });

  it('expires, and never applies to another browser or garbage', () => {
    expect(isWebglFailureMarker({ ua: UA, at: NOW - WEBGL_FAILED_TTL_MS }, UA, NOW)).toBe(false);
    expect(isWebglFailureMarker({ ua: 'other', at: NOW }, UA, NOW)).toBe(false);
    expect(isWebglFailureMarker({ ua: UA, at: NOW + 60_000 }, UA, NOW)).toBe(false);
    expect(isWebglFailureMarker({ ua: UA }, UA, NOW)).toBe(false);
    expect(isWebglFailureMarker(true, UA, NOW)).toBe(false);
    expect(isWebglFailureMarker(null, UA, NOW)).toBe(false);
  });
});

describe('resolveSimpleMode', () => {
  const base = { preference: null, webgl2: true, webglFailed: false, lowEnd: false };

  it('defaults to 3D on capable devices', () => {
    expect(resolveSimpleMode(base)).toBe(false);
  });

  it('defaults to simple on low-end hints, but an explicit choice wins', () => {
    expect(resolveSimpleMode({ ...base, lowEnd: true })).toBe(true);
    expect(resolveSimpleMode({ ...base, lowEnd: true, preference: false })).toBe(false);
    expect(resolveSimpleMode({ ...base, preference: true })).toBe(true);
  });

  it('is forced when 3D cannot run, whatever was chosen', () => {
    expect(resolveSimpleMode({ ...base, webgl2: false, preference: false })).toBe(true);
    expect(resolveSimpleMode({ ...base, webglFailed: true, preference: false })).toBe(true);
    expect(isSimpleModeForced({ webgl2: false, webglFailed: false })).toBe(true);
    expect(isSimpleModeForced({ webgl2: true, webglFailed: true })).toBe(true);
    expect(isSimpleModeForced({ webgl2: true, webglFailed: false })).toBe(false);
  });
});

describe('applySimpleAttribute', () => {
  it('sets and removes the attribute', () => {
    const attributes = new Map<string, string>();
    const root = {
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
      removeAttribute: (name: string) => void attributes.delete(name),
    };
    applySimpleAttribute(true, root);
    expect(attributes.get(SIMPLE_MODE_ATTRIBUTE)).toBe('');
    applySimpleAttribute(false, root);
    expect(attributes.has(SIMPLE_MODE_ATTRIBUTE)).toBe(false);
  });
});

interface BootCase {
  stored?: string | null;
  failed?: string | null;
  webgl2?: boolean;
  hints?: DeviceHints;
  storageThrows?: boolean;
}

/** Runs the boot script in an isolated context with fake browser globals. */
function boot({
  stored = null,
  failed = null,
  webgl2 = true,
  hints = {},
  storageThrows = false,
}: BootCase) {
  const attributes = new Map<string, string>();
  const values: Record<string, string | null> = {
    [SIMPLE_MODE_STORAGE_KEY]: stored,
    [WEBGL_FAILED_STORAGE_KEY]: failed,
  };
  const context: Record<string, unknown> = {
    JSON,
    Date: { now: () => NOW },
    navigator: {
      userAgent: UA,
      deviceMemory: hints.deviceMemory,
      hardwareConcurrency: hints.hardwareConcurrency,
      connection: hints.saveData === undefined ? undefined : { saveData: hints.saveData },
    },
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
      },
    },
  };
  if (storageThrows) {
    Object.defineProperty(context, 'localStorage', {
      get() {
        throw new Error('SecurityError');
      },
    });
  } else {
    context.localStorage = { getItem: (key: string) => values[key] ?? null };
  }
  if (webgl2) context.WebGL2RenderingContext = function WebGL2RenderingContext() {};
  runInNewContext(simpleModeBootScript(), context);
  return attributes.has(SIMPLE_MODE_ATTRIBUTE);
}

const parse = (raw: string | null): unknown => {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
};

describe('simpleModeBootScript', () => {
  it('matches resolveSimpleMode for every combination', () => {
    const storedValues = [null, 'true', 'false', '"on"', 'not json'];
    const failedValues = [
      null,
      JSON.stringify({ ua: UA, at: NOW - 1000 }),
      JSON.stringify({ ua: UA, at: NOW - WEBGL_FAILED_TTL_MS - 1 }),
      JSON.stringify({ ua: 'other', at: NOW }),
      'garbage',
    ];
    const hintValues: DeviceHints[] = [
      {},
      { deviceMemory: 8, hardwareConcurrency: 8, saveData: false },
      { deviceMemory: 2 },
      { hardwareConcurrency: 2 },
      { saveData: true },
    ];
    for (const webgl2 of [true, false]) {
      for (const stored of storedValues) {
        for (const failed of failedValues) {
          for (const hints of hintValues) {
            const expected = resolveSimpleMode({
              preference: parseSimplePreference(parse(stored)),
              webgl2,
              webglFailed: isWebglFailureMarker(parse(failed), UA, NOW),
              lowEnd: isLowEndDevice(hints),
            });
            expect(
              boot({ stored, failed, webgl2, hints }),
              JSON.stringify({ stored, failed, webgl2, hints }),
            ).toBe(expected);
          }
        }
      }
    }
  });

  it('survives blocked storage (no choice, no marker)', () => {
    expect(boot({ storageThrows: true })).toBe(false);
    expect(boot({ storageThrows: true, webgl2: false })).toBe(true);
    expect(boot({ storageThrows: true, hints: { hardwareConcurrency: 2 } })).toBe(true);
  });

  it('stays small and free of HTML-breaking characters', () => {
    const script = simpleModeBootScript();
    expect(script.length).toBeLessThan(700);
    expect(script).not.toMatch(/<\/?script/i);
    expect(script).toContain(SIMPLE_MODE_STORAGE_KEY);
    expect(script).toContain(WEBGL_FAILED_STORAGE_KEY);
  });
});
