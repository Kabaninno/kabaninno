import { fogChunk, orbitPositionGlsl, pointSizeChunk, softPointChunk } from './chunks';

/**
 * Orbit preview around a category node: one faint line per service orbit with
 * a comet-like tail behind the moving "planet spark". Geometry is baked on the
 * CPU (radius/tilt/yaw); the spark angle is computed from time on the GPU.
 */
export const orbitLineVertex = /* glsl */ `
attribute float aAngle;
attribute float aSpeed;
attribute float aPhase;
attribute float aOrbit;

varying float vAngle;
varying float vSpeed;
varying float vPhase;
varying float vDepth;
varying float vOrbit;

void main() {
  vOrbit = aOrbit;
  vAngle = aAngle;
  vSpeed = aSpeed;
  vPhase = aPhase;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const orbitLineFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uEmphasis;
uniform float uOpacity;
/** 1 in the universe preview; 0 in the system view, where real planets move. */
uniform float uTail;
/** Highlighted orbit (hovered / focused planet) and how much. */
uniform float uHot;
uniform float uHotAmount;

varying float vAngle;
varying float vSpeed;
varying float vPhase;
varying float vDepth;
varying float vOrbit;

${fogChunk}

const float TAU = 6.28318530718;

void main() {
  float head = vPhase + uTime * vSpeed;
  float direction = vSpeed < 0.0 ? -1.0 : 1.0;
  float behind = mod((head - vAngle) * direction, TAU);
  float tail = exp(-behind * 1.8);
  float hot = abs(vOrbit - uHot) < 0.5 ? uHotAmount : 0.0;
  float a = (0.11 + 0.2 * uEmphasis + 0.6 * hot) + tail * (0.5 + 0.4 * uEmphasis) * uTail;
  a *= uOpacity * fogFactor(vDepth);
  gl_FragColor = vec4(mix(uColor, vec3(1.0), hot * 0.35), clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

export const orbitSparkVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uPixelRatio;
uniform float uEmphasis;

attribute float aRadius;
attribute float aTilt;
attribute float aYaw;
attribute float aSpeed;
attribute float aPhase;
attribute float aSize;
attribute vec3 aColor;

varying vec3 vColor;
varying float vAlpha;

${fogChunk}
${orbitPositionGlsl}
${pointSizeChunk}

void main() {
  vec3 local = orbitPosition(aRadius, aTilt, aYaw, aPhase + uTime * aSpeed);
  vec4 mv = modelViewMatrix * vec4(local, 1.0);
  float energy;
  float worldSize = aSize * (1.0 + 0.35 * uEmphasis);
  gl_PointSize = attenuatedPointSize(worldSize, -mv.z, uScale, 2.0 * uPixelRatio, 48.0 * uPixelRatio, energy);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = energy * fogFactor(-mv.z);
}
`;

export const orbitSparkFragment = /* glsl */ `
uniform float uEmphasis;
uniform float uOpacity;

varying vec3 vColor;
varying float vAlpha;

${softPointChunk}

void main() {
  float a = softPoint(gl_PointCoord, 14.0, 0.45) * vAlpha * (0.75 + 0.35 * uEmphasis) * uOpacity;
  if (a < 0.003) discard;
  vec3 color = mix(vColor, vec3(1.0), 0.35);
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
