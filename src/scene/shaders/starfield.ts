import { pointSizeChunk, softPointChunk } from './chunks';

/** Star layer: soft round points, perspective size attenuation, subtle twinkle. */
export const starfieldVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uPixelRatio;
uniform float uTwinkle;
uniform float uBrightness;

attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;

varying vec3 vColor;
varying float vAlpha;

${pointSizeChunk}

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float energy;
  gl_PointSize = attenuatedPointSize(aSize, -mv.z, uScale, 1.4 * uPixelRatio, 7.0 * uPixelRatio, energy);
  gl_Position = projectionMatrix * mv;

#ifdef LOW_QUALITY
  float twinkle = 1.0;
#else
  // Only part of the stars twinkle, each at its own slow rate.
  float rate = 0.35 + fract(aPhase * 7.31) * 1.25;
  float wave = 0.5 + 0.5 * sin(uTime * rate + aPhase * 40.0);
  float twinkle = 1.0 - uTwinkle * step(0.45, fract(aPhase * 3.17)) * wave;
#endif

  vColor = aColor;
  vAlpha = uBrightness * energy * twinkle;
}
`;

export const starfieldFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

${softPointChunk}

void main() {
  float a = softPoint(gl_PointCoord, 9.0, 0.28) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor, a);
  #include <colorspace_fragment>
}
`;
