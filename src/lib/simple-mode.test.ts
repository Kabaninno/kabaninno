import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  SIMPLE_MODE_ATTRIBUTE,
  SIMPLE_MODE_STORAGE_KEY,
  applySimpleAttribute,
  parseSimplePreference,
  resolveSimpleMode,
  simpleModeBootScript,
} from './simple-mode';

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

describe('resolveSimpleMode', () => {
  it('defaults to 3D when WebGL 2 is available', () => {
    expect(resolveSimpleMode(null, true)).toBe(false);
    expect(resolveSimpleMode(false, true)).toBe(false);
  });

  it('honours an explicit choice', () => {
    expect(resolveSimpleMode(true, true)).toBe(true);
  });

  it('is forced without the WebGL 2 API, whatever was chosen', () => {
    expect(resolveSimpleMode(null, false)).toBe(true);
    expect(resolveSimpleMode(false, false)).toBe(true);
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

/** Runs the boot script in an isolated context with fake browser globals. */
function boot({
  stored,
  webgl2 = true,
  storageThrows = false,
}: {
  stored?: string | null;
  webgl2?: boolean;
  storageThrows?: boolean;
}) {
  const attributes = new Map<string, string>();
  const context: Record<string, unknown> = {
    JSON,
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
      },
    },
    localStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error('SecurityError');
        return key === SIMPLE_MODE_STORAGE_KEY ? (stored ?? null) : null;
      },
    },
  };
  if (webgl2) context.WebGL2RenderingContext = function WebGL2RenderingContext() {};
  runInNewContext(simpleModeBootScript(), context);
  return attributes.has(SIMPLE_MODE_ATTRIBUTE);
}

describe('simpleModeBootScript', () => {
  it('matches resolveSimpleMode for every stored value and API state', () => {
    for (const webgl2 of [true, false]) {
      for (const stored of [null, 'true', 'false', '"on"', 'not json', '{"simple":true}']) {
        let preference: boolean | null = null;
        try {
          preference = parseSimplePreference(JSON.parse(stored ?? 'null'));
        } catch {
          preference = null;
        }
        expect(boot({ stored, webgl2 }), `stored=${stored} webgl2=${webgl2}`).toBe(
          resolveSimpleMode(preference, webgl2),
        );
      }
    }
  });

  it('survives blocked storage', () => {
    expect(boot({ storageThrows: true })).toBe(false);
    expect(boot({ storageThrows: true, webgl2: false })).toBe(true);
  });

  it('stays tiny and free of HTML-breaking characters', () => {
    const script = simpleModeBootScript();
    expect(script.length).toBeLessThan(300);
    expect(script).not.toMatch(/<\/?script/i);
    expect(script).toContain(SIMPLE_MODE_STORAGE_KEY);
  });
});
