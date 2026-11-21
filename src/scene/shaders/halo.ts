import { fogChunk } from './chunks';

/**
 * Camera-facing additive glow (billboard built in the vertex shader). Lifted
 * toward the camera by `uLift` so it blooms softly over the opaque core, and
 * dimmed when the camera is very close so it never washes out a system view.
 */
export const haloVertex = /* glsl */ `
uniform float uSize;
uniform float uLift;
uniform float uEmphasis;

varying vec2 vUv;
varying float vDepth;

void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  // Slide along the camera ray (keeps the projected centre) far enough that the
  // view-depth lift equals uLift: off-axis nodes would otherwise poke through.
  float rayScale = length(mv.xyz) / max(-mv.z, 0.001);
  mv.xyz += normalize(-mv.xyz) * uLift * rayScale;
  mv.xy += position.xy * uSize * (1.0 + 0.22 * uEmphasis);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const haloFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;
uniform float uIntensity;
uniform float uEmphasis;

varying vec2 vUv;
varying float vDepth;

${fogChunk}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  if (d >= 1.0) discard;
  float core = exp(-d * d * 30.0);
  float glow = exp(-d * d * 7.0) * 0.32 + exp(-d * 3.2) * 0.2;
#ifdef LOW_QUALITY
  float streak = 0.0;
#else
  // Faint anamorphic streak: a lens-like accent, kept subtle.
  float streak = exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 2.4) * 0.3;
#endif
  float edge = 1.0 - smoothstep(0.62, 1.0, d);
  float closeFade = mix(0.28, 1.0, smoothstep(2.0, 12.0, vDepth));
  float a = (core + glow + streak) * edge * uIntensity * (0.7 + 0.65 * uEmphasis) * closeFade;
  a *= fogFactor(vDepth);
  // The centre tints toward the glow only halfway: the halo keeps the DNA hue (V-07).
  vec3 color = mix(uColor, mix(uColor, uGlow, 0.5), clamp(core * 1.4, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
