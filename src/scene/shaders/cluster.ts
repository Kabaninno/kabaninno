import { fogChunk, pointSizeChunk, softPointChunk } from './chunks';

/**
 * Portfolio "archive": a distant silver globular cluster. Background stars plus
 * one brighter star per visible project (aKind = 1).
 */
export const clusterVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uPixelRatio;
uniform float uEmphasis;
uniform float uBrightness;

attribute float aSize;
attribute float aKind;
attribute float aPhase;
attribute vec3 aColor;

varying vec3 vColor;
varying float vAlpha;
varying float vKind;

${fogChunk}
${pointSizeChunk}

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float energy;
  float size = aSize * (1.0 + (0.18 + 0.25 * aKind) * uEmphasis);
  gl_PointSize = attenuatedPointSize(size, -mv.z, uScale, 1.4 * uPixelRatio, 26.0 * uPixelRatio, energy);
  gl_Position = projectionMatrix * mv;
#ifdef LOW_QUALITY
  float shimmer = 1.0;
#else
  float shimmer = 0.8 + 0.2 * sin(uTime * (0.5 + aPhase) + aPhase * 30.0);
#endif
  vColor = aColor;
  vKind = aKind;
  vAlpha = energy * shimmer * uBrightness * (0.75 + 0.45 * uEmphasis) * fogFactor(-mv.z);
}
`;

export const clusterFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vKind;

${softPointChunk}

void main() {
  float a = softPoint(gl_PointCoord, mix(8.0, 16.0, vKind), mix(0.25, 0.55, vKind)) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
