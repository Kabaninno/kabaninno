import { fogChunk, pointSizeChunk, softPointChunk } from './chunks';

/**
 * The universe network in two draw calls:
 * - minor nodes: soft glowing points with a slow drift and twinkle;
 * - every link (main ring, dendrites into main nodes, the minor web) in one
 *   LineSegments geometry. Each vertex knows both link ends: a main end reads
 *   its drift and hover emphasis from the per-node uniform arrays, a minor
 *   end recomputes the same drift as its point, so links stay attached.
 * Data impulses travel A → B; links into a highlighted node fire more often
 * (data rushes into the hovered capability). Array size: MAX_NODES.
 */

/** Drift of a minor node (shared by the points and the links). */
const minorDriftChunk = /* glsl */ `
vec3 minorDrift(vec3 phase, float time) {
  vec3 w = 0.07 + phase * 0.06;
  return vec3(
    sin(time * w.x + phase.y * 6.2831),
    sin(time * w.y + phase.z * 6.2831) * 0.6,
    cos(time * w.z + phase.x * 6.2831)
  ) * 0.22;
}
`;

export const minorNodesVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uPixelRatio;
uniform float uNetwork;
uniform float uDrift;

attribute float aSize;
attribute float aBrightness;
attribute vec3 aPhase;
attribute vec3 aColor;

varying vec3 vColor;
varying float vAlpha;

${fogChunk}
${pointSizeChunk}
${minorDriftChunk}

void main() {
  vec3 p = position + minorDrift(aPhase, uTime) * uDrift;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float energy;
  gl_PointSize = attenuatedPointSize(aSize, -mv.z, uScale, 2.2 * uPixelRatio, 14.0 * uPixelRatio, energy);
  gl_Position = projectionMatrix * mv;
#ifdef LOW_QUALITY
  float twinkle = 1.0;
#else
  float twinkle = 0.76 + 0.24 * sin(uTime * (0.35 + aPhase.x * 0.9) + aPhase.y * 40.0);
#endif
  vColor = aColor;
  vAlpha = aBrightness * energy * twinkle * uNetwork * fogFactor(-mv.z);
}
`;

export const minorNodesFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

${softPointChunk}

void main() {
  float a = softPoint(gl_PointCoord, 15.0, 0.6) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.18), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

export const networkLinksVertex = /* glsl */ `
uniform vec3 uOffsets[MAX_NODES];
uniform float uEmphasis[MAX_NODES];
uniform float uPresence[MAX_NODES];
uniform float uTime;
uniform float uDrift;

attribute float aT;
// xyz: drift phase of a minor end; w: main node index + 1 (0 for a minor end).
attribute vec4 aEndA;
attribute vec4 aEndB;
attribute float aSeed;
attribute float aKind;
attribute vec3 aColor;

varying float vT;
varying float vSeed;
varying float vKind;
varying float vEmphasis;
varying float vDepth;
varying vec3 vColor;
varying float vPresence;

${minorDriftChunk}

vec3 endOffset(vec4 end) {
  if (end.w > 0.5) return uOffsets[int(end.w - 0.5)];
  return minorDrift(end.xyz, uTime) * uDrift;
}

float endEmphasis(vec4 end) {
  if (end.w > 0.5) return uEmphasis[int(end.w - 0.5)];
  return 0.0;
}

float endPresence(vec4 end) {
  if (end.w > 0.5) return uPresence[int(end.w - 0.5)];
  return 1.0;
}

void main() {
  vec3 offset = mix(endOffset(aEndA), endOffset(aEndB), aT);
  vec4 mv = modelViewMatrix * vec4(position + offset, 1.0);
  vT = aT;
  vSeed = aSeed;
  vKind = aKind;
  vEmphasis = max(endEmphasis(aEndA), endEmphasis(aEndB));
  vPresence = min(endPresence(aEndA), endPresence(aEndB));
  vDepth = -mv.z;
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`;

export const networkLinksFragment = /* glsl */ `
uniform float uTime;
uniform float uNetwork;
uniform float uPulses;
/** Visible label text box (GL px, bottom-left origin); x > z means none. */
uniform vec4 uLabelRect;

varying float vT;
varying float vSeed;
varying float vKind;
varying float vEmphasis;
varying float vDepth;
varying vec3 vColor;
varying float vPresence;

${fogChunk}

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  // Link kind: 0 = main ring, 1 = dendrite (minor → main), 2 = minor web.
  float isMain = 1.0 - step(0.5, vKind);
  float isMinor = step(1.5, vKind);
  float isDendrite = 1.0 - isMain - isMinor;

  float breathe = 0.78 + 0.22 * sin(uTime * 0.6 + vSeed * 6.2831);
  float level = isMain * 0.15 + isDendrite * 0.06 + isMinor * 0.03;
  float base = (level + (isMain * 0.34 + isDendrite * 0.3) * vEmphasis) * breathe;

  // Occasional data impulses; links into a highlighted node fire more often.
  float rate = isMain * 0.075 + isDendrite * 0.1 + isMinor * 0.055 + 0.09 * vEmphasis;
  float idle = isMain * 0.48 + isDendrite * 0.74 + isMinor * 0.88 - 0.55 * vEmphasis;
  float cycle = uTime * rate + vSeed * 7.0;
  float firing = step(idle, hash(floor(cycle) + vSeed * 91.0));
  float head = fract(cycle) * 1.3 - 0.15;
  float dist = vT - head;
  float sharpness = mix(1400.0, 520.0, 1.0 - isMain);
  float pulse = exp(-dist * dist * sharpness) + exp(-max(-dist, 0.0) * 26.0) * step(dist, 0.0) * 0.22;
  pulse *= firing * uPulses * (isMain + isDendrite * 0.85 + isMinor * 0.6);

  float ends = smoothstep(0.0, 0.07, vT) * (1.0 - smoothstep(0.93, 1.0, vT));
  float a = (base + pulse * (0.75 + 0.4 * vEmphasis)) * ends * uNetwork * vPresence * fogFactor(vDepth);
  // Links crossing the visible label dim under its text (visual L-03).
  vec2 fc = gl_FragCoord.xy;
  if (fc.x > uLabelRect.x && fc.x < uLabelRect.z && fc.y > uLabelRect.y && fc.y < uLabelRect.w) {
    a *= 0.3;
  }
  vec3 color = mix(vColor, vec3(1.0), clamp(pulse * 0.45, 0.0, 0.6));
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
