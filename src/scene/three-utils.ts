import { Color, type Camera, type PerspectiveCamera } from 'three';
import type { RootState } from '@react-three/fiber';
import { FOG_DENSITY, PALETTE } from './config';

/** Frozen moment shown under prefers-reduced-motion (a pleasant composition). */
const REDUCED_MOTION_TIME = 17.5;

/** Animation time for shaders: the clock, or a fixed moment under reduced motion. */
export function motionTime(state: RootState, reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_MOTION_TIME : state.clock.elapsedTime;
}

export function isPerspectiveCamera(camera: Camera): camera is PerspectiveCamera {
  return (camera as PerspectiveCamera).isPerspectiveCamera === true;
}

/**
 * Converts world size to device pixels at unit depth for point sprites:
 * viewport height (device px) / (2 * tan(fov / 2)).
 */
export function pointScale(state: RootState): number {
  const fov = isPerspectiveCamera(state.camera) ? state.camera.fov : 50;
  return (state.size.height * state.viewport.dpr) / (2 * Math.tan((fov * Math.PI) / 360));
}

/** Uniforms every fogged material needs (see shaders/chunks.ts fogChunk). */
export function fogUniforms() {
  return {
    uFogDensity: { value: FOG_DENSITY },
    uFogColor: { value: new Color(PALETTE.fog) },
  };
}
