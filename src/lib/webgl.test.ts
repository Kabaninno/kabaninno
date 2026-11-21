import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Loads a fresh copy of the module: `isWebGLAvailable` caches its result. */
async function loadWebgl() {
  vi.resetModules();
  return import('./webgl');
}

function stubDocument(getContext: (type: string) => unknown) {
  const createElement = vi.fn(() => ({ getContext: vi.fn(getContext) }));
  vi.stubGlobal('document', { createElement });
  return createElement;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isWebGLAvailable', () => {
  it('is false without a document (SSR / build time)', async () => {
    const { isWebGLAvailable } = await loadWebgl();
    expect(isWebGLAvailable()).toBe(false);
  });

  it('prefers WebGL2, releases the probe context and caches the answer', async () => {
    const loseContext = vi.fn();
    const createElement = stubDocument((type) =>
      type === 'webgl2'
        ? {
            getExtension: (name: string) =>
              name === 'WEBGL_lose_context' ? { loseContext } : null,
          }
        : null,
    );
    const { isWebGLAvailable } = await loadWebgl();
    expect(isWebGLAvailable()).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
    expect(isWebGLAvailable()).toBe(true);
    expect(createElement).toHaveBeenCalledOnce();
  });

  it('falls back to WebGL 1', async () => {
    stubDocument((type) => (type === 'webgl' ? { getExtension: () => null } : null));
    const { isWebGLAvailable } = await loadWebgl();
    expect(isWebGLAvailable()).toBe(true);
  });

  it('is false when no context can be created', async () => {
    stubDocument(() => null);
    const { isWebGLAvailable } = await loadWebgl();
    expect(isWebGLAvailable()).toBe(false);
  });

  it('is false when probing throws (blocked by policy or extension)', async () => {
    stubDocument(() => {
      throw new Error('blocked');
    });
    const { isWebGLAvailable } = await loadWebgl();
    expect(isWebGLAvailable()).toBe(false);
  });
});
