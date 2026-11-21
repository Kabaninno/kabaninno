import { fogChunk } from './chunks';
import { hashChunk, planetFragmentHead } from './planet-common';

/**
 * Portfolio archive (observatory) shaders: the project card-objects and the
 * slow observatory rings around the wall. Cards use the planet vertex shader
 * (world position / normal, object position) and are lit by the cluster's
 * bright core like planets are by theirs.
 */

/**
 * Card-object: a thin glass slab with a holographic face — inner frame,
 * header bar in the main category's colour, a few seeded "text" lines, one
 * colour chip per category and a slow scan sweeping down. Object space: the
 * card is centred, its front face at z = +uHalfDepth.
 */
export const archiveCardFragment = /* glsl */ `
${planetFragmentHead}
${hashChunk}
uniform vec2 uHalfSize;
uniform float uHalfDepth;
uniform vec3 uChips[4];
uniform float uChipCount;
/** Filter emphasis (portfolio category filter, D87), 0..1. */
uniform float uSelect;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

/** Anti-aliased filled box. */
float bar(vec2 p, vec2 center, vec2 halfSize) {
  vec2 q = abs(p - center) - halfSize;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  return 1.0 - smoothstep(0.0, fwidth(d) * 1.2 + 1e-4, d);
}

void main() {
  Surface s = surface();
  float f = fresnel(s.n, s.v, 3.0);
  vec3 r = reflect(-s.v, s.n);
  vec3 refl = envColor(r, s.l);
#ifdef LOW_QUALITY
  vec3 body = uColor * 0.07 + refl * (0.2 + 0.6 * f);
#else
  vec3 t = refract(-s.v, s.n, 0.8);
  vec3 body = envColor(t, s.l) * mix(vec3(1.0), uColor, 0.75) * 0.4 + refl * (0.16 + 0.8 * f);
#endif

  vec2 p = vObjPos.xy;
  float face = step(uHalfDepth * 0.7, abs(vObjPos.z));
  float front = step(uHalfDepth * 0.7, vObjPos.z);
  float frameD = roundedBox(p, uHalfSize - 0.08, 0.1);
  float frame = (1.0 - smoothstep(0.006, 0.006 + fwidth(frameD) * 1.2 + 1e-4, abs(frameD))) * face;
  float header = bar(p, vec2(-uHalfSize.x + 0.38, uHalfSize.y - 0.2), vec2(0.22, 0.034));
  float lines = 0.0;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float halfLength = (0.3 + 0.6 * hash11(fk * 7.13 + uSeed * 3.1)) * (uHalfSize.x - 0.2);
    lines += bar(p, vec2(-uHalfSize.x + 0.2 + halfLength, -0.24 - fk * 0.15), vec2(halfLength, 0.013));
  }
  float chips = 0.0;
  vec3 chipColor = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uChipCount) break;
    vec2 c = vec2(-uHalfSize.x + 0.27 + float(i) * 0.2, -uHalfSize.y + 0.22);
    float d = length(p - c) - 0.055;
    float dotMask = 1.0 - smoothstep(0.0, fwidth(d) * 1.2 + 1e-4, d);
    chips += dotMask;
    chipColor += uChips[i] * dotMask;
  }
  float deco = front * (header * 1.2 + lines * 0.5);
#ifdef LOW_QUALITY
  float sweep = 0.0;
#else
  float cycle = fract(uTime * 0.11 + uSeed * 0.37);
  float sweepY = mix(uHalfSize.y + 0.4, -uHalfSize.y - 0.4, cycle);
  float sweep = exp(-pow((p.y - sweepY) * 7.0, 2.0)) * 0.2 * front;
#endif

  float lift = 1.0 + 0.6 * uHover + 0.45 * uSelect;
  vec3 color = body;
  color += uGlow * (frame * 0.95 + pow(f, 2.0) * (0.35 + 0.5 * uHover + 0.3 * uSelect)) * lift;
  color += uColor * (deco + sweep) * 1.3 * lift;
  color += chipColor * front * 1.6;
  color += uCoreColor * pow(max(dot(r, s.l), 0.0), 60.0) * 1.4;
  float alpha = 0.24 + 0.55 * f + frame * 0.6 + deco * 0.7 + chips * front * 0.9 + sweep;
  gl_FragColor = finishTransparent(color, alpha);
  #include <colorspace_fragment>
}
`;

/**
 * Observatory rings: three concentric circles around the archive wall made
 * of long arcs and fine ticks that turn slowly in alternating directions —
 * an observatory dial; with no projects yet it is the calm "archive being
 * prepared" signal around the dormant cluster.
 */
export const observatoryRingsVertex = /* glsl */ `
attribute float aAngle;
attribute float aRing;

varying float vAngle;
varying float vRing;
varying float vDepth;

void main() {
  vAngle = aAngle;
  vRing = aRing;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const observatoryRingsFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uTime;
uniform float uIntensity;

varying float vAngle;
varying float vRing;
varying float vDepth;

${fogChunk}

void main() {
  float direction = mod(vRing, 2.0) < 0.5 ? 1.0 : -1.0;
  float turn = vAngle / 6.28318 + uTime * (0.012 + vRing * 0.006) * direction;
  float arcs = step(0.22, fract(turn * (2.0 + vRing)));
#ifdef LOW_QUALITY
  float ticks = 0.0;
#else
  float ticks = step(0.9, fract(turn * 96.0)) * step(0.5, vRing) * step(vRing, 1.5);
#endif
  float alpha = (arcs * (0.3 - vRing * 0.06) + ticks * 0.35) * uIntensity * fogFactor(vDepth);
  vec3 color = mix(uColor, uAccent, ticks * 0.6);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
