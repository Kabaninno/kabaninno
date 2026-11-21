import { fogChunk } from './chunks';

/**
 * Network links ("integrations"). Curves are baked on the CPU; node drift is
 * applied on the GPU from a per-node offset array so links stay attached to
 * drifting nodes. Data impulses travel A → B on a subset of links per cycle.
 * Array size is injected as MAX_NODES (see MAX_UNIVERSE_NODES).
 */
export const linksVertex = /* glsl */ `
uniform vec3 uOffsets[MAX_NODES];
uniform float uEmphasis[MAX_NODES];

attribute float aT;
attribute float aA;
attribute float aB;
attribute float aSeed;
attribute vec3 aColor;

varying float vT;
varying float vSeed;
varying float vEmphasis;
varying float vDepth;
varying vec3 vColor;

void main() {
  int a = int(aA + 0.5);
  int b = int(aB + 0.5);
  vec3 offset = mix(uOffsets[a], uOffsets[b], aT);
  vec4 mv = modelViewMatrix * vec4(position + offset, 1.0);
  vT = aT;
  vSeed = aSeed;
  vEmphasis = max(uEmphasis[a], uEmphasis[b]);
  vDepth = -mv.z;
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`;

export const linksFragment = /* glsl */ `
uniform float uTime;
uniform float uNetwork;
uniform float uPulses;

varying float vT;
varying float vSeed;
varying float vEmphasis;
varying float vDepth;
varying vec3 vColor;

${fogChunk}

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float breathe = 0.82 + 0.18 * sin(uTime * 0.6 + vSeed * 6.2831);
  float base = (0.15 + 0.38 * vEmphasis) * breathe;

  // One impulse per link per cycle; roughly half of the links fire each cycle.
  float cycle = uTime * 0.075 + vSeed * 7.0;
  float firing = step(0.48, hash(floor(cycle) + vSeed * 91.0));
  float head = fract(cycle) * 1.3 - 0.15;
  float dist = vT - head;
  float pulse = exp(-dist * dist * 1400.0) + exp(-max(-dist, 0.0) * 28.0) * step(dist, 0.0) * 0.22;
  pulse *= firing * uPulses;

  float ends = smoothstep(0.0, 0.07, vT) * (1.0 - smoothstep(0.93, 1.0, vT));
  float a = (base + pulse * (0.75 + 0.4 * vEmphasis)) * ends * uNetwork * fogFactor(vDepth);
  vec3 color = mix(vColor, vec3(1.0), clamp(pulse * 0.45, 0.0, 0.6));
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
