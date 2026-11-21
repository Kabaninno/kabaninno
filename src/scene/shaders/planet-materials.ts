import { simplexNoise3d } from './chunks';
import { planetFragmentHead } from './planet-common';

/**
 * Planet surface shaders, one per DNA `material` (registry in
 * system/planet-materials.ts). All are lit by the system core; LOW_QUALITY
 * drops the noise (analytic patterns instead).
 */

/** Glass: refraction tinted by the DNA colour, fresnel reflections, glinting facet edges. */
export const glassFragment = /* glsl */ `
${planetFragmentHead}
/** Minimum look (registry entry look): alpha floor and fresnel rim strength. */
uniform float uMinOpacity;
uniform float uRim;
uniform float uFacetEdges;

void main() {
  Surface s = surface();
  float f = fresnel(s.n, s.v, 3.0);
  vec3 r = reflect(-s.v, s.n);
  vec3 t = refract(-s.v, s.n, 0.78);
  vec3 refl = envColor(r, s.l);
  vec3 refr = envColor(t, s.l) * mix(vec3(1.0), uColor, 0.8);
  // Facet edges (hard-edged shapes only): normal discontinuities light up.
  float edge = facetEdge(s.n, uFacetEdges);
  float spec = pow(max(dot(r, s.l), 0.0), 70.0) * 2.6;
  vec3 color = refr * 0.6 + uColor * (0.1 + pow(s.facing, 2.0) * 0.18 * s.light);
  color += refl * (0.22 + 0.95 * f);
  // A rim in the glow colour and glowing facet edges keep clear glass readable
  // against deep space (BL-F3-01).
  color += uGlow * (edge * 0.95 + pow(f, 1.6) * uRim * (1.0 + 0.6 * uHover));
  color += uCoreColor * spec;
  float alpha = max(uMinOpacity, 0.3 + 0.62 * f + edge * 0.45 + spec);
  gl_FragColor = finishTransparent(color, alpha);
  #include <colorspace_fragment>
}
`;

/** Liquid metal: chrome reflections of the core-lit environment over flowing ripples. */
export const liquidMetalFragment = /* glsl */ `
${planetFragmentHead}
#ifndef LOW_QUALITY
${simplexNoise3d}
#endif

void main() {
  Surface s = surface();
  vec3 n = s.n;
#ifdef LOW_QUALITY
  n = normalize(n + 0.18 * vec3(sin(vObjPos.y * 9.0 + uTime), sin(vObjPos.x * 8.0 - uTime * 0.8), 0.0));
#else
  vec3 q = vObjPos * 2.3 + vec3(0.0, uTime * 0.32, uSeed);
  vec3 ripple = vec3(snoise(q), snoise(q + vec3(5.2, 1.3, 2.7)), snoise(q - vec3(1.7, 4.1, 0.6)));
  n = normalize(n + ripple * 0.32);
#endif
  vec3 r = reflect(-s.v, n);
  vec3 tint = mix(vec3(0.82), uColor, 0.45);
  vec3 color = envColor(r, s.l) * tint * 1.7;
  // Chrome contrast: a dark band under the horizon of the reflection.
  color *= 0.45 + 0.75 * smoothstep(-0.25, 0.5, r.y);
  color += uCoreColor * pow(max(dot(r, s.l), 0.0), 90.0) * 3.2;
  color += uColor * s.light * 0.07;
  color += uGlow * fresnel(n, s.v, 4.0) * (0.35 + 0.5 * uHover);
  gl_FragColor = finishOpaque(color);
  #include <colorspace_fragment>
}
`;

/** Hologram: additive scanlines, fresnel rim, glitch flicker, a dotted data grid. */
export const hologramFragment = /* glsl */ `
${planetFragmentHead}
uniform float uOpacity;
uniform float uMinOpacity;
uniform float uRim;

void main() {
  Surface s = surface();
  float f = fresnel(s.n, s.v, 2.0);
  float scan = 0.55 + 0.45 * sin(vObjPos.y * 42.0 - uTime * 3.2);
  vec3 g = fract(vObjPos * 7.0);
  float dots = step(0.9, max(max(g.x, g.y), g.z));
#ifdef LOW_QUALITY
  float flicker = 1.0;
#else
  float glitch = step(0.93, fract(sin(floor(uTime * 6.0) + uSeed * 7.1) * 43758.5453));
  float flicker = 1.0 - glitch * 0.45 * (0.5 + 0.5 * sin(vObjPos.y * 140.0));
#endif
  vec3 color = mix(uColor, uGlow, f) * (0.3 + 1.2 * f + 0.4 * scan + 0.5 * dots);
  color += uGlow * pow(f, 1.5) * uRim * 0.5;
  float alpha = max((0.1 + 0.8 * f + 0.16 * scan + 0.25 * dots) * flicker, uMinOpacity);
  alpha *= 1.0 + 0.4 * uHover;
  gl_FragColor = finishTransparent(color, alpha * uOpacity);
  #include <colorspace_fragment>
}
`;

/** Iridescent: thin-film interference that shifts with the view angle and a slow flow. */
export const iridescentFragment = /* glsl */ `
${planetFragmentHead}
#ifndef LOW_QUALITY
${simplexNoise3d}
#endif

void main() {
  Surface s = surface();
#ifdef LOW_QUALITY
  float flow = 0.5 + 0.5 * sin(vObjPos.x * 5.0 + vObjPos.y * 3.0 + uTime * 0.4);
#else
  float flow = snoise(vObjPos * 1.1 + vec3(uSeed, uTime * 0.12, -uTime * 0.09)) * 0.5 + 0.5;
#endif
  float thickness = s.facing * 1.1 + flow * 0.4;
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (thickness + vec3(0.0, 0.33, 0.67)));
  vec3 color = uColor * 0.1 + film * (0.3 + 0.7 * fresnel(s.n, s.v, 1.4)) * mix(0.5, 1.25, s.light);
  color = mix(color, color * uColor * 1.6, 0.28);
  color += uCoreColor * pow(max(dot(reflect(-s.v, s.n), s.l), 0.0), 40.0) * 1.8;
  color += uGlow * fresnel(s.n, s.v, 3.0) * 0.4 * uHover;
  gl_FragColor = finishOpaque(color);
  #include <colorspace_fragment>
}
`;

/** Emissive: a self-lit energy body with flowing bands and a slow pulse (HDR, blooms). */
export const emissiveFragment = /* glsl */ `
${planetFragmentHead}
uniform float uFacetEdges;
#ifndef LOW_QUALITY
${simplexNoise3d}
#endif

void main() {
  Surface s = surface();
#ifdef LOW_QUALITY
  float n = 0.5 + 0.5 * sin(vObjPos.x * 6.0 + uTime * 0.9);
#else
  float n = snoise(vObjPos * 2.6 + vec3(0.0, uTime * 0.55, uSeed)) * 0.5 + 0.5;
#endif
  // 60 % less noise (MJ-F3-01: blotchy): the bands carry the energy flow.
  n = 0.5 + (n - 0.5) * 0.4;
  float bands = 0.5 + 0.5 * sin(vObjPos.y * 14.0 + uTime * 2.0 + n * 4.0);
  float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + uSeed);
  vec3 color = mix(uColor * 0.45, uGlow * 1.9, smoothstep(0.3, 0.95, n * 0.6 + bands * 0.4));
  color *= pulse * (1.0 + 0.3 * uHover);
  // Facet edges light up on hard-edged shapes (the dart): a crisp, cut body.
  float edge = facetEdge(s.n, uFacetEdges);
  color += uGlow * (fresnel(s.n, s.v, 2.5) * 1.1 + edge * 1.3);
  // Never past the accent (MJ-F4-01: a white blown-out body lost its hue and bands).
  color = min(color, max(uColor, uGlow) * 1.15);
  gl_FragColor = finishOpaque(color);
  #include <colorspace_fragment>
}
`;
