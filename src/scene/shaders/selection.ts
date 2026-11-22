import { fogChunk, pointSizeChunk, softPointChunk } from './chunks';

/**
 * Configurator selection (D81): every category the visitor picked is wired
 * to the configurator beacon by a lit link with data packets flowing INTO the
 * beacon ("your request is being assembled"). Lines and impulse sprites read
 * the per-node runtime arrays (drift offsets, eased link growth, hover,
 * presence) like the network does, so links stay attached to drifting nodes.
 * A new link grows from its category (t = 0) into the beacon (t = 1) behind a
 * bright spark, and withdraws the same way. Array size: MAX_NODES.
 */

/** Soft length of a growing link's front, in curve units (t). */
export const LINK_FRONT = 0.18;

/** Growth front, shared by the vertex and fragment programs. */
const linkFrontChunk = /* glsl */ `
const float LINK_FRONT = ${LINK_FRONT.toFixed(2)};

// Grown share of the link at curve position t for a front at "front".
float linkGrown(float front, float t) {
  return clamp((front - t) / LINK_FRONT, 0.0, 1.0);
}
`;

/** Shared uniforms and helpers of the line and sprite programs. */
const selectionHead = /* glsl */ `
uniform vec3 uOffsets[MAX_NODES];
// Eased growth of each category's link (0 = none, 1 = reaches the beacon).
uniform float uLink[MAX_NODES];
uniform float uHover[MAX_NODES];
uniform float uPresence[MAX_NODES];
// Index of the configurator beacon in the arrays.
uniform float uBeacon;
uniform float uTime;

${linkFrontChunk}

// Front of the category's link in curve units (past 1 once it is fully grown).
float linkFront(int cat) {
  return uLink[cat] * (1.0 + LINK_FRONT);
}

// Link presence at t: faded where its ends leave the free frame.
float linkPresence(int cat, int beacon, float t) {
  return mix(uPresence[cat], uPresence[beacon], t);
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
varying float vFront;
varying float vPresence;
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
  vFront = linkFront(cat);
  vPresence = linkPresence(cat, beacon, aT);
  vHover = uHover[cat];
  vSeed = aSeed;
  vFlow = aFlow;
  vColor = aColor;
  vDepth = -mv.z;
  // Links with nothing to show collapse outside the clip volume as a whole (no fragment work).
  bool hidden = uLink[cat] < 0.001 || max(uPresence[cat], uPresence[beacon]) < 0.001;
  gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
}
`;

export const selectionLinksFragment = /* glsl */ `
uniform float uTime;
uniform float uPulses;
uniform vec3 uBeaconColor;

varying float vT;
varying float vFront;
varying float vPresence;
varying float vHover;
varying float vSeed;
varying vec2 vFlow;
varying vec3 vColor;
varying float vDepth;

${fogChunk}
${linkFrontChunk}

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
  // Growth: the grown part of the link, and a spark at its front while it
  // travels toward the beacon (gone once the link has arrived).
  float grown = linkGrown(vFront, vT);
  float lead = vFront - vT;
  float spark = step(0.0, lead) * exp(-lead * 26.0)
    * (1.0 - smoothstep(1.0, 1.0 + LINK_FRONT, vFront));
  float ends = smoothstep(0.0, 0.06, vT) * (1.0 - smoothstep(0.94, 1.0, vT));
  float base = 0.42 * shimmer * (1.0 + 0.7 * vHover);
  float a = ((base + packet * 1.3) * grown + spark) * ends * vPresence * fogFactor(vDepth);
  vec3 color = mix(vColor, uBeaconColor, smoothstep(0.3, 1.0, vT));
  color = mix(
    color,
    vec3(1.0),
    clamp(packet * 0.55 * grown + spark * 0.6 + vHover * 0.15, 0.0, 0.8)
  );
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
  // Packets only travel on the grown part of the link.
  float amount = linkGrown(linkFront(cat), u) * linkPresence(cat, beacon, u);
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
