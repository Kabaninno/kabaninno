import { simplexNoise3d } from './chunks';

/**
 * Cosmos backdrop rendered inside the canvas (sky sphere centred on the
 * camera, drawn first, no depth). The fragment shader reproduces the CSS
 * `.backdrop-cosmos` layers of globals.css exactly — same colours (read from
 * the CSS tokens at runtime), same ellipses, same stops, composited in sRGB
 * like the browser does — so the opaque canvas lands pixel-for-pixel on the
 * CSS backdrop it fades in over, while bloom gets a real background to
 * composite on. On top: a faint dust lane along the star band, computed per
 * vertex on the sphere, which (unlike the screen-space gradients) rotates
 * with the camera and adds depth. LOW_QUALITY drops the dust.
 */
export const backdropVertex = /* glsl */ `
uniform vec3 uBandNormal;

varying float vDust;

#ifndef LOW_QUALITY
${simplexNoise3d}
#endif

void main() {
  vec3 dir = normalize(position);
#ifdef LOW_QUALITY
  vDust = 0.0;
#else
  float band = dot(dir, uBandNormal);
  float lane = exp(-band * band * 38.0);
  float n1 = snoise(dir * 2.3 + vec3(3.1, 0.0, 7.7)) * 0.5 + 0.5;
  float n2 = snoise(dir * 5.4 + vec3(-1.7, 4.2, 0.3)) * 0.5 + 0.5;
  vDust = lane * (0.55 * n1 + 0.45 * n2) * (0.6 + 0.4 * n1);
#endif
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const backdropFragment = /* glsl */ `
uniform vec2 uResolution;
uniform vec3 uVoid;
uniform vec3 uDeep;
uniform vec3 uNebula;
uniform vec3 uBrand;
uniform vec3 uDust;

varying float vDust;

// Gradient position along an ellipse ray (1 = on the ending ellipse), CSS semantics.
float ray(vec2 uv, vec2 centre, vec2 radii) {
  return length((uv - centre) / radii);
}

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // CSS coordinates: origin top-left, fractions of the viewport.
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y;

  vec3 c = uVoid;
  // radial-gradient(70% 55% at 10% 0%, brand 5%, transparent 70%)
  c = mix(c, uBrand, 0.05 * (1.0 - clamp(ray(uv, vec2(0.10, 0.0), vec2(0.70, 0.55)) / 0.70, 0.0, 1.0)));
  // radial-gradient(80% 60% at 82% 100%, nebula 7%, transparent 70%)
  c = mix(c, uNebula, 0.07 * (1.0 - clamp(ray(uv, vec2(0.82, 1.0), vec2(0.80, 0.60)) / 0.70, 0.0, 1.0)));
  // radial-gradient(120% 90% at 50% 38%, deep 0%, transparent 62%)
  c = mix(c, uDeep, 1.0 - clamp(ray(uv, vec2(0.50, 0.38), vec2(1.20, 0.90)) / 0.62, 0.0, 1.0));

  c += uDust * vDust;
  // ±0.5/255 dither: the gradient is dark enough to band at 8 bits.
  c += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(srgbToLinear(max(c, vec3(0.0))), 1.0);
  #include <colorspace_fragment>
}
`;
