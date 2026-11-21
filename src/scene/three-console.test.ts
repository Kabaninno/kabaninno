import { Clock, error as threeError, warn as threeWarn } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterR3fClockDeprecation, isClockDeprecation } from './three-console';

describe('filterR3fClockDeprecation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('recognises only the Clock deprecation warning', () => {
    const message = 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.';
    expect(isClockDeprecation('warn', message)).toBe(true);
    expect(isClockDeprecation('error', message)).toBe(false);
    expect(isClockDeprecation('warn', 'THREE.WebGLRenderer: Context Lost.')).toBe(false);
    expect(isClockDeprecation('warn', undefined)).toBe(false);
  });

  it('drops the Clock warning and forwards every other three.js message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    filterR3fClockDeprecation();
    filterR3fClockDeprecation(); // idempotent

    new Clock();
    expect(warn).not.toHaveBeenCalled();

    threeWarn('WebGLRenderer: Something else.', 42);
    expect(warn).toHaveBeenCalledWith('THREE.WebGLRenderer: Something else.', 42);
    threeError('WebGLProgram: Shader Error');
    expect(error).toHaveBeenCalledWith('THREE.WebGLProgram: Shader Error');
  });
});
