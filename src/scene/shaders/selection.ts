import { fogChunk, pointSizeChunk, softPointChunk } from './chunks';

/**
 * Configurator selection (D81): every category the visitor picked is wired
 * to the configurator beacon by a lit link with data packets flowing INTO the
 * beacon ("your request is being assembled"). Lines and impulse sprites read
 * the per-node runtime arrays (drift offsets, eased selected state, hover,
 * presence) like the network does, so links stay attached to drifting nodes
 * and fade in/out with the selection. Array size: MAX_NODES.
 */

/** Shared uniforms and helpers of the line and sprite programs. */
const selectionHead = /* glsl */ `
uniform vec3 uOffsets[MAX_NODES];
uniform float uSelected[MAX_NODES];
uniform float uHover[MAX_NODES];
uniform float uPresence[MAX_NODES];
/** Index of the configurator beacon in the arrays. */
uniform float uBeacon;
uniform float uTime;

/** Link amount: selected state of the category end, faded where it leaves the free frame. */
float linkAmount(int cat, int beacon, float t) {
  return uSelected[cat] * mix(uPresence[cat], uPresence[beacon], t);
}
`;

export const selectionLinksVertex = /* glsl */ `
${selectionHead}

attribute float aT;
attribute float aCat;
attribute float aSeed;
/** Packet pattern: x = packets on the link, y = pattern cycles per second. */
attribute vec2 aFlow;
attribute vec3 aColor;

varying float vT;
varying float vAmount;
varying float vHover;
varying float vSeed;
varying vec2 vFlow;
varying vec3 vColor;
varying float vDepth;

void main() {
  int cat = int(aCat + 0.5);
  int beacon = int(uBeacon + 0.5);
  vec3 offset = mix(uOffsets[cat], uOffsets[beacon], aT);
  vec4 mv = modelViewMatrix * vec4(position + offset, 1.0);
  vT = aT;
  vAmount = linkAmount(cat, beacon, aT);
  vHover = uHover[cat];
  vSeed = aSeed;
  vFlow = aFlow;
  vColor = aColor;
  vDepth = -mv.z;
  // Unselected links collapse outside the clip volume (no fragment work).
  gl_Position = vAmount < 0.001 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
}
`;

export const selectionLinksFragment = /* glsl */ `
uniform float uTime;
uniform float uPulses;
uniform vec3 uBeaconColor;

varying float vT;
varying float vAmount;
varying float vHover;
varying float vSeed;
varying vec2 vFlow;
varying vec3 vColor;
varying float vDepth;

${fogChunk}

void main() {
  // Packets run from the category (t = 0) into the beacon (t = 1): a bright
  // head with a short tail behind it.
  float f = fract(vT * vFlow.x - uTime * vFlow.y + vSeed);
  float packet = pow(f, 12.0) * (1.0 - smoothstep(0.955, 1.0, f)) * uPulses;
#ifdef LOW_QUALITY
  float shimmer = 1.0;
#else
  float shimmer = 0.85 + 0.15 * sin(vT * 40.0 - uTime * 3.0 + vSeed * 6.2831);
#endif
  float ends = smoothstep(0.0, 0.06, vT) * (1.0 - smoothstep(0.94, 1.0, vT));
  float base = 0.42 * shimmer * (1.0 + 0.7 * vHover);
  float a = (base + packet * 1.3) * ends * vAmount * fogFactor(vDepth);
  vec3 color = mix(vColor, uBeaconColor, smoothstep(0.3, 1.0, vT));
  color = mix(color, vec3(1.0), clamp(packet * 0.55 + vHover * 0.15, 0.0, 0.7));
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

/**
 * Impulse sprites: glowing heads of the packets, moving along the same
 * quadratic curve as the line (start = category, control, end = beacon).
 */
export const selectionPulsesVertex = /* glsl */ `
${selectionHead}
uniform float uScale;
uniform float uPixelRatio;
uniform float uSize;

attribute vec3 aStart;
attribute vec3 aControl;
attribute float aCat;
/** Link seed / packets (phase shift in curve units). */
attribute float aSeed;
/** Sprite slot k of the link: x = k / packets, y = pattern cycles per second / packets. */
attribute vec2 aSlot;
attribute vec3 aColor;

varying float vAlpha;
varying float vU;
varying vec3 vColor;

${fogChunk}
${pointSizeChunk}

void main() {
  int cat = int(aCat + 0.5);
  int beacon = int(uBeacon + 0.5);
  // Heads of the line packets: t·N − time·R + seed = k  ⇔  t = (k + time·R − seed) / N.
  float u = fract(aSlot.x + uTime * aSlot.y - aSeed);
  float w = 1.0 - u;
  vec3 p = w * w * aStart + 2.0 * w * u * aControl + u * u * position;
  p += mix(uOffsets[cat], uOffsets[beacon], u);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float energy;
  float hover = uHover[cat];
  gl_PointSize = attenuatedPointSize(uSize * (1.0 + 0.35 * hover), -mv.z, uScale, 2.0 * uPixelRatio, 22.0 * uPixelRatio, energy);
  float amount = linkAmount(cat, beacon, u);
  float ends = smoothstep(0.02, 0.12, u) * (1.0 - smoothstep(0.86, 0.99, u));
  vAlpha = amount * ends * (0.55 + 0.45 * energy) * fogFactor(-mv.z);
  vU = u;
  vColor = aColor;
  gl_Position = vAlpha < 0.002 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
}
`;

export const selectionPulsesFragment = /* glsl */ `
uniform vec3 uBeaconColor;
uniform float uPulses;

varying float vAlpha;
varying float vU;
varying vec3 vColor;

${softPointChunk}

void main() {
  float a = softPoint(gl_PointCoord, 6.5, 0.7) * vAlpha * uPulses;
  if (a < 0.003) discard;
  vec3 color = mix(mix(vColor, uBeaconColor, smoothstep(0.4, 1.0, vU)), vec3(1.0), 0.35);
  gl_FragColor = vec4(color * 1.4, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
