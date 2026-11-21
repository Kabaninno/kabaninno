import { fogChunk, fresnelChunk, simplexNoise3d } from './chunks';

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
 * - DETAIL (system view, prewarmed) adds a style-driven surface faded in by
 *   `uDetail`. At uDetail = 0 it renders exactly like the base variant, so
 *   swapping the universe core for the detailed one never pops. The style
 *   parameters come from the DNA `core` value (universe/core-styles.ts).
 */
export const nodeCoreVertex = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObjPos;

void main() {
  vObjPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`;

export const nodeCoreFragment = /* glsl */ `
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
// x: flow scale, y: flow speed, z: ridge scale, w: ridge sharpness
uniform vec4 uStyleA;
// x: strata bands, y: forge crust, z: iridescence, w: comet stream
uniform vec4 uStyleB;
uniform float uFacet;
#endif

varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vObjPos;

${fogChunk}
${fresnelChunk}
#ifndef LOW_QUALITY
${simplexNoise3d}
#endif

void main() {
  vec3 n = normalize(vNormalV);
#ifdef DETAIL
  // Prism: faceted glass normals blended in.
  vec3 faceN = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  n = normalize(mix(n, faceN, uFacet * uDetail));
#endif
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

#ifdef DETAIL
  {
    // Comet: the pattern streams along -X like a tail.
    vec3 q = vec3(p.x * (1.0 - 0.6 * uStyleB.w) + uTime * 0.35 * uStyleB.w, p.y, p.z);
#ifdef LOW_QUALITY
    float f2 = 0.5 + 0.5 * sin(q.x * uStyleA.x * 3.0 + q.y * 5.0 + uTime * uStyleA.y * 4.0 + uSeed);
    float r2 = pow(1.0 - abs(sin(q.y * uStyleA.z * 2.0 + q.z * 3.0 + uSeed)), uStyleA.w);
#else
    float f2 = snoise(q * uStyleA.x + vec3(uSeed, uTime * uStyleA.y, 0.0)) * 0.5 + 0.5;
    float r2 = pow(1.0 - abs(snoise(q * uStyleA.z + vec3(0.0, uSeed, uTime * uStyleA.y * 0.8))), uStyleA.w);
#endif
    vec3 styled = mix(uColor * 0.26, uColor * 0.9, f2) + mix(uColor, uGlow, 0.5) * r2 * 0.7;
    // Strata: scrolling horizontal data bands.
    float bands = 0.5 + 0.5 * sin(p.y * 22.0 + f2 * 3.0 - uTime * 0.6);
    styled = mix(styled, mix(uColor * 0.32, uGlow, bands), uStyleB.x * 0.65);
    // Forge: dark cooled crust over molten metal.
    styled *= mix(1.0, mix(1.0, 0.22, smoothstep(0.45, 0.62, f2)), uStyleB.y);
    // Neural: iridescent hue drift.
    vec3 iri = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f2 * 0.8 + facing * 0.6));
    styled = mix(styled, styled * (0.55 + iri), uStyleB.z * 0.6);
    body = mix(body, styled, uDetail);
  }
#endif

  // Limb darkening: the sphere reads as a glowing volume, not a flat disc.
  body *= mix(0.5, 1.0, pow(facing, 0.6));

  // V-07: DNA-coloured HDR hot centre (bloom keeps the hue).
  vec3 hot = mix(uColor, uGlow, 0.3) * (mix(1.25, 1.05, detail) + 0.55 * uEmphasis + 0.6 * uSmall);
  float hotWeight = mix(0.72, 0.42, detail) + 0.22 * uEmphasis + 0.2 * uSmall;
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
