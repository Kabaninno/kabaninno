import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWebGLAvailable } from './webgl';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isWebGLAvailable', () => {
  it('is false without a window (SSR / build time)', () => {
    expect(isWebGLAvailable()).toBe(false);
  });

  it('is true when the WebGL 2 API exists, without creating any context', () => {
    const getContext = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ getContext })) });
    vi.stubGlobal('window', { WebGL2RenderingContext: function WebGL2RenderingContext() {} });
    expect(isWebGLAvailable()).toBe(true);
    expect(getContext).not.toHaveBeenCalled();
  });

  it('is false when only WebGL 1 exists (three.js needs WebGL 2)', () => {
    vi.stubGlobal('window', { WebGLRenderingContext: function WebGLRenderingContext() {} });
    expect(isWebGLAvailable()).toBe(false);
  });
});
