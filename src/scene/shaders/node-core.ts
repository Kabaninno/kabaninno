import { fogChunk, fresnelChunk, simplexNoise3d } from './chunks';
import { hashChunk, voronoiChunk } from './planet-common';

/**
 * Energy core of a universe node: flowing plasma (noise body + ridged-noise
 * filaments in the glow color), limb darkening for volume, a hot centre and a
 * thin glow-colored fresnel rim.
 *
 * Colour (V-07): the hot centre is a DNA-coloured HDR value (category colour
 * tinted toward its glow, boosted above 1) instead of a mix toward white, so
 * bloom spreads the category hue; only a pinpoint at the very centre is
 * white. `uSmall` lifts cores drawn near their minimum on-screen size.
 *
 * Variants:
 * - LOW_QUALITY replaces the 3D noise with a cheap analytic pattern;
 * - DETAIL (system view, prewarmed): `buildCoreFragment(styleChunk)` inserts
 *   one of the five core styles (shaders/core-styles.ts, one program each),
 *   faded in by `uDetail`. At uDetail = 0 every variant renders exactly like
 *   the universe core, so the swap during the dive never pops. A style may
 *   also deform the sphere (CORE_DEFORM, scaled by uDetail as well).
 */

export function buildCoreVertex(deform: boolean): string {
  return /* glsl */ `
uniform float uTime;
uniform float uSeed;
#ifdef DETAIL
uniform float uDetail;
#endif

varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObjPos;

${deform ? simplexNoise3d : ''}

void main() {
  vec3 pos = position;
${
  deform
    ? `#ifdef DETAIL
  // Fluid core: a slow noise swell along the normal (system view only).
  float swell = snoise(normalize(position) * 1.6 + vec3(uSeed, uTime * 0.28, -uTime * 0.21));
  pos += normal * swell * 0.11 * length(position) * uDetail;
#endif`
    : ''
}
  vObjPos = position;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;
}

/**
 * Core fragment shader. `styleChunk` defines
 * `vec3 coreStyle(vec3 p, vec3 n, vec3 v, float t)` (system-view surface of
 * one DNA core style) and is only called in the DETAIL variant.
 */
export function buildCoreFragment(styleChunk: string): string {
  return /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec3 uFogColor;
uniform float uTime;
uniform float uEmphasis;
uniform float uSeed;
uniform float uSmall;
/** 0..1: fades the node into the fog when overlays would cover it. */
uniform float uPresence;
#ifdef DETAIL
uniform float uDetail;
#endif

varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObjPos;

${fogChunk}
${fresnelChunk}
#ifndef LOW_QUALITY
${simplexNoise3d}
#endif
#ifdef DETAIL
${hashChunk}
${voronoiChunk}
${styleChunk}
#endif

void main() {
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(-vViewPos);
  float facing = clamp(dot(n, v), 0.0, 1.0);
  vec3 p = normalize(vObjPos);

#ifdef LOW_QUALITY
  float flow = 0.5 + 0.5 * sin(p.y * 9.0 + p.x * 4.0 + uTime * 0.8 + uSeed);
  float ridge = pow(1.0 - abs(sin(p.y * 7.0 + p.z * 5.0 + uTime * 0.5 + uSeed)), 6.0);
#else
  float flow = snoise(p * 2.2 + vec3(uSeed, uTime * 0.18, -uTime * 0.13)) * 0.5 + 0.5;
  // Ridged noise: thin bright plasma filaments.
  float ridge = 1.0 - abs(snoise(p * 3.4 + vec3(-uTime * 0.21, uSeed, uTime * 0.16)));
  ridge = pow(ridge, 7.0);
#endif

  // Surface detail only up close: from afar it would alias into dark specks.
  float detail = 1.0 - smoothstep(5.0, 14.0, -vViewPos.z);
  vec3 body = mix(uColor * mix(0.8, 0.34, detail), uColor, smoothstep(0.15, 0.95, flow));
  body += uGlow * ridge * 0.85 * detail;
  float styleMix = 0.0;
#ifdef DETAIL
  styleMix = uDetail;
  body = mix(body, coreStyle(p, n, v, uTime), styleMix);
#endif

  // Limb darkening: the sphere reads as a glowing volume, not a flat disc.
  body *= mix(0.5, 1.0, pow(facing, 0.6));

  // V-07: DNA-coloured HDR hot centre (bloom keeps the hue). The system
  // view keeps it small, so the style's surface reads.
  vec3 hot = mix(uColor, uGlow, 0.3) * (mix(1.25, 1.05, detail) + 0.55 * uEmphasis + 0.6 * uSmall);
  float hotWeight = (mix(0.72, 0.42, detail) + 0.22 * uEmphasis + 0.2 * uSmall) * (1.0 - 0.7 * styleMix);
  vec3 color = mix(body, hot, clamp(pow(facing, mix(2.2, 4.5, detail)) * hotWeight, 0.0, 1.0));
  // White only as a pinpoint at the very centre.
  color += vec3(0.2) * pow(facing, 28.0) * (1.0 - 0.6 * detail);
  color += mix(uColor, uGlow, 0.55) * fresnel(n, v, 3.0) * (0.9 + 0.9 * uEmphasis + 0.5 * uSmall);
  color *= 0.95 + 0.35 * uEmphasis;

  color = mix(uFogColor, color, fogFactor(-vViewPos.z) * uPresence);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;
}

/** The universe core (no style; also the beacon core). */
export const nodeCoreVertex = buildCoreVertex(false);
export const nodeCoreFragment = buildCoreFragment('');
