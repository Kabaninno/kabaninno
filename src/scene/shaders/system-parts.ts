import { fogChunk, orbitPositionGlsl, pointSizeChunk, softPointChunk } from './chunks';
import { hashChunk, planetFragmentHead } from './planet-common';

/**
 * Accessories of the planets and cores in a system view: wireframe shells,
 * data rings, moons, the conveyor track, orbit trails and the comet tail.
 */

/** Line shader (wireframe shell, conveyor track): DNA glow with a slow pulse. */
export const lineVertex = /* glsl */ `
varying float vDepth;
varying vec3 vObjPos;

void main() {
  vObjPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const lineFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform float uHover;
uniform float uFade;
uniform float uDim;

varying float vDepth;
varying vec3 vObjPos;

${fogChunk}

void main() {
#ifdef LOW_QUALITY
  float pulse = 1.0;
#else
  // A slow signal sweeping over the lattice.
  float pulse = 0.65 + 0.35 * sin(vObjPos.y * 9.0 - uTime * 1.6 + uSeed);
#endif
  vec3 color = mix(uColor, uGlow, 0.6);
  float alpha = uOpacity * pulse * (1.0 + 0.6 * uHover) * uFade * uDim * fogFactor(vDepth);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

/**
 * Data ring (RingGeometry in its XY plane): concentric bands with dark gaps;
 * multi-band rings carry data segments that run around at their own speed.
 */
export const ringVertex = /* glsl */ `
varying vec2 vRingPos;
varying float vDepth;

void main() {
  // Polar coordinates are taken per fragment: interpolating the angle across
  // its ±π wrap drew a seam (visual mn3).
  vRingPos = position.xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;
uniform float uTime;
uniform float uSeed;
uniform float uInner;
uniform float uOuter;
uniform float uBands;
uniform float uOpacity;
uniform float uHover;
uniform float uFade;
uniform float uDim;

varying vec2 vRingPos;
varying float vDepth;

${fogChunk}
${hashChunk}

void main() {
  vec2 vPolar = vec2(length(vRingPos), atan(vRingPos.y, vRingPos.x));
  float t = clamp((vPolar.x - uInner) / (uOuter - uInner), 0.0, 1.0);
  float band = t * uBands;
  float id = floor(band);
  float f = fract(band);
  float body = smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.82, 1.0, f));
  float line = exp(-pow((f - 0.5) * 6.0, 2.0));
  float edges = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.96, 1.0, t));
  float dash = 1.0;
#ifndef LOW_QUALITY
  if (uBands > 1.5) {
    float direction = mod(id, 2.0) < 1.0 ? 1.0 : -1.0;
    float speed = 0.04 + hash11(id + uSeed * 3.1) * 0.1;
    float seg = fract(vPolar.y / 6.28318 * (10.0 + id * 4.0) + uTime * speed * direction);
    dash = 0.35 + 0.65 * step(0.4, seg);
  }
#endif
  vec3 color = mix(uColor, uGlow, line * 0.7);
  float alpha = uOpacity * edges * (0.22 + 0.6 * body * dash + 0.3 * line) * (1.0 + 0.5 * uHover);
  gl_FragColor = vec4(color, clamp(alpha * uFade * uDim * fogFactor(vDepth), 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

/** Moons (instanced): small lit bodies, DNA-tinted, with a rim in the glow colour. */
export const moonFragment = /* glsl */ `
${planetFragmentHead}

void main() {
  Surface s = surface();
  vec3 r = reflect(-s.v, s.n);
  vec3 color = uColor * (0.12 + 0.75 * s.light) + envColor(r, s.l) * 0.35;
  color += uGlow * fresnel(s.n, s.v, 2.5) * 0.8;
  color += uCoreColor * pow(max(dot(r, s.l), 0.0), 50.0) * 1.5;
  gl_FragColor = finishOpaque(color);
  #include <colorspace_fragment>
}
`;

/**
 * Orbit trail: points along the orbit behind the planet (angle computed on
 * the GPU from the planet's live angle), fading and shrinking with age.
 */
export const trailVertex = /* glsl */ `
uniform float uHead;
uniform float uArc;
uniform float uRadius;
uniform float uTilt;
uniform float uYaw;
uniform float uSize;
uniform float uScale;
uniform float uPixelRatio;
uniform float uTime;

attribute float aT;
attribute float aJitter;

varying float vAlpha;
varying float vT;

${fogChunk}
${orbitPositionGlsl}
${pointSizeChunk}

void main() {
  float angle = uHead - aT * uArc;
  vec3 local = orbitPosition(uRadius * (1.0 + (aJitter - 0.5) * 0.04 * aT), uTilt, uYaw, angle);
  vec4 mv = modelViewMatrix * vec4(local, 1.0);
  float energy;
  float size = uSize * mix(1.0, 0.25, aT);
  gl_PointSize = attenuatedPointSize(size, -mv.z, uScale, 1.2 * uPixelRatio, 24.0 * uPixelRatio, energy);
  gl_Position = projectionMatrix * mv;
  vT = aT;
  vAlpha = energy * pow(1.0 - aT, 1.6) * fogFactor(-mv.z);
}
`;

export const trailFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;
uniform float uFade;
uniform float uDim;

varying float vAlpha;
varying float vT;

${softPointChunk}

void main() {
  float a = softPoint(gl_PointCoord, 10.0, 0.5) * vAlpha * uFade * uDim;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uGlow, uColor, vT), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

/**
 * Comet tail of the comet core: particles stream off the nucleus along the
 * system's -X axis, spreading and fading with age (system-local units).
 */
export const cometTailVertex = /* glsl */ `
uniform float uTime;
uniform float uCoreRadius;
uniform float uLength;
uniform float uScale;
uniform float uPixelRatio;
uniform float uIntensity;

attribute vec3 aSeed;

varying float vAlpha;
varying float vAge;

${fogChunk}
${pointSizeChunk}

void main() {
  float age = fract(aSeed.x + uTime * (0.08 + aSeed.y * 0.06));
  float spread = (0.18 + age * 0.9) * uCoreRadius;
  float angle = aSeed.z * 6.28318;
  // Gentle curl so the tail does not read as a straight cone.
  float bend = age * age * 0.35 * uLength;
  vec3 p = vec3(
    -uCoreRadius * 0.8 - age * uLength,
    cos(angle) * spread + bend * 0.3,
    sin(angle) * spread - bend
  );
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float energy;
  gl_PointSize = attenuatedPointSize(uCoreRadius * mix(0.16, 0.05, age), -mv.z, uScale, 1.4 * uPixelRatio, 18.0 * uPixelRatio, energy);
  gl_Position = projectionMatrix * mv;
  vAge = age;
  vAlpha = energy * pow(1.0 - age, 1.4) * smoothstep(0.0, 0.08, age) * uIntensity * fogFactor(-mv.z);
}
`;

export const cometTailFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;

varying float vAlpha;
varying float vAge;

${softPointChunk}

void main() {
  float a = softPoint(gl_PointCoord, 9.0, 0.4) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uGlow * 1.4, uColor, vAge), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
