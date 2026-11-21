import { fogChunk } from './chunks';

/**
 * Configurator beacon: an axis-locked vertical light beam (cylindrical
 * billboard around world Y) and sonar-like ping rings on its horizontal plane.
 */
export const beamVertex = /* glsl */ `
uniform float uWidth;
uniform float uHeight;

varying vec2 vUv;
varying float vDepth;

void main() {
  vUv = uv;
  vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 side = normalize(cross(up, normalize(-center.xyz)));
  vec3 pos = center.xyz + side * position.x * uWidth + up * position.y * uHeight;
  vDepth = -pos.z;
  gl_Position = projectionMatrix * vec4(pos, 1.0);
}
`;

export const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uEmphasis;
uniform float uIntensity;

varying vec2 vUv;
varying float vDepth;

${fogChunk}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float across = exp(-abs(p.x) * 6.0) * 0.7 + exp(-abs(p.x) * 26.0) * 0.8;
  // The beam shoots upward; below the beacon it fades out quickly.
  float along = p.y > 0.0 ? exp(-p.y * 1.7) * (1.0 - p.y) : exp(p.y * 7.0);
#ifdef LOW_QUALITY
  float signal = 1.0;
#else
  // Signal bands rising along the beam.
  float signal = 0.78 + 0.22 * sin(p.y * 26.0 - uTime * 3.2);
#endif
  float a = across * along * signal * uIntensity * (0.75 + 0.6 * uEmphasis) * fogFactor(vDepth);
  vec3 color = mix(uColor, vec3(1.0), exp(-abs(p.x) * 30.0) * 0.6);
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

export const pingVertex = /* glsl */ `
varying vec2 vUv;
varying float vDepth;

void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const pingFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uEmphasis;
uniform float uPing;
uniform float uIntensity;

varying vec2 vUv;
varying float vDepth;

${fogChunk}

void main() {
  float d = length(vUv * 2.0 - 1.0);
  if (d >= 1.0) discard;
  float a = 0.0;
  for (int k = 0; k < 2; k++) {
    float r = fract(uTime * 0.28 + float(k) * 0.5);
    float ring = exp(-pow((d - r) * 30.0, 2.0));
    a += ring * (1.0 - r) * (1.0 - r);
  }
  a *= uPing;
  // Static inner disc glow so the base reads even when pings are frozen.
  a += exp(-d * 9.0) * 0.25;
  a *= (0.6 + 0.6 * uEmphasis) * uIntensity * fogFactor(vDepth);
  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
