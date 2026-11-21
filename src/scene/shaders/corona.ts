import { fogChunk, simplexNoise3d } from './chunks';

/**
 * Corona of the system-view core: an additive glow whose brightness depends
 * on how close the view ray passes to the core (impact parameter `b`), so it
 * peaks at the limb and falls off outward like a real corona — a fresnel
 * shell would do the opposite and read as a flat ring. Drawn on a front-
 * facing shell (one fragment per pixel), with a slow noise flicker in the
 * DNA colours. Part of the prewarmed system content; `uIntensity` follows
 * the dive (0 in the overview).
 */
export const coronaVertex = /* glsl */ `
varying vec3 vViewPos;
varying vec3 vCenter;
varying vec3 vObjPos;

void main() {
  vObjPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const coronaFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
/** Core radius in view units; the shell spans CORONA_SCALE times it. */
uniform float uCoreRadius;
uniform float uReach;

varying vec3 vViewPos;
varying vec3 vCenter;
varying vec3 vObjPos;

${fogChunk}
#ifndef LOW_QUALITY
${simplexNoise3d}
#endif

void main() {
  // Distance between the core centre and this pixel's view ray.
  float b = length(cross(normalize(vViewPos), vCenter));
  float h = max(b - uCoreRadius, 0.0) / uCoreRadius;
#ifdef LOW_QUALITY
  float flicker = 0.7;
#else
  vec3 p = normalize(vObjPos);
  float flicker = snoise(p * 2.6 + vec3(0.0, uTime * 0.2, uSeed)) * 0.5 + 0.5;
  flicker = mix(flicker, snoise(p * 6.5 - vec3(uTime * 0.27, uSeed, 0.0)) * 0.5 + 0.5, 0.4);
#endif
  float limb = exp(-h * 3.2) * (0.55 + 0.75 * flicker);
  // In front of the core only a faint veil; at the shell edge nothing.
  float inside = 1.0 - step(uCoreRadius, b);
  float fade = 1.0 - smoothstep(uReach * 0.72, uReach, b / uCoreRadius);
  float a = mix(limb, 0.12, inside) * fade * uIntensity * fogFactor(-vViewPos.z);
  vec3 color = mix(mix(uColor, uGlow, 0.55), uColor, smoothstep(0.0, 0.6, h));
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
