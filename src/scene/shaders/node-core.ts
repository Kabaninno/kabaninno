import { fogChunk, fresnelChunk, simplexNoise3d } from './chunks';

/**
 * Energy core of a universe node: flowing plasma (noise body + ridged-noise
 * filaments in the glow color), limb darkening for volume, a small white-hot
 * centre and a thin glow-colored fresnel rim. From afar it reads as a colored
 * star; up close the filaments become visible.
 * LOW_QUALITY replaces the 3D noise with a cheap analytic pattern.
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
  // Limb darkening: the sphere reads as a glowing volume, not a flat disc.
  body *= mix(0.5, 1.0, pow(facing, 0.6));
  vec3 hot = mix(uGlow, vec3(1.0), 0.35);
  float hotWeight = mix(0.62, 0.38, detail) + 0.3 * uEmphasis;
  vec3 color = mix(body, hot, pow(facing, mix(2.5, 5.0, detail)) * hotWeight);
  color += uGlow * fresnel(n, v, 3.0) * (0.9 + 0.9 * uEmphasis);
  color *= 0.95 + 0.4 * uEmphasis;

  color = mix(uFogColor, color, fogFactor(-vViewPos.z));
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;
