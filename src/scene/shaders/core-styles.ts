/**
 * System-view surfaces of the five DNA core styles. Each defines
 * `vec3 coreStyle(vec3 p, vec3 n, vec3 v, float t)` for buildCoreFragment
 * (`p`: unit position on the sphere, object space; `n`, `v`: view-space
 * normal and view direction). One program per style; LOW_QUALITY variants
 * avoid noise and Voronoi loops. Available helpers: snoise (not in
 * LOW_QUALITY), hash11/hash13/hash33, voronoi3, uColor, uGlow, uSeed.
 */

/** Web: cut glass — Voronoi facets with their own tint, glinting edges, sparkle, slow pulse. */
export const prismStyle = /* glsl */ `
vec3 coreStyle(vec3 p, vec3 n, vec3 v, float t) {
#ifdef LOW_QUALITY
  vec3 cell = floor(p * 3.0 + 0.5);
  float edge = 0.0;
#else
  vec3 cell;
  vec2 d = voronoi3(p * 3.1 + vec3(uSeed), cell);
  float edge = 1.0 - smoothstep(0.0, 0.07, d.y - d.x);
#endif
  float shade = hash13(cell);
  float facing = clamp(dot(n, v), 0.0, 1.0);
  vec3 glass = mix(uColor * 0.18, uColor * 0.95, shade * shade);
  // Light seems to bounce inside: facets turned toward the viewer catch the core's heart.
  glass += mix(uColor, uGlow, 0.5) * pow(facing, 3.0) * shade * 0.6;
  glass += uGlow * edge * 1.5;
  glass += vec3(0.9, 1.0, 1.0) * pow(facing, 16.0) * step(0.82, shade) * 0.9;
  return glass * (0.9 + 0.12 * sin(t * 1.7 + uSeed));
}
`;

/** CRM: layered data strata scrolling in alternating directions, packets of light, rising pulse rings. */
export const strataStyle = /* glsl */ `
vec3 coreStyle(vec3 p, vec3 n, vec3 v, float t) {
  float layers = 9.0;
  float y = p.y * 0.5 + 0.5;
  float id = floor(y * layers);
  float f = fract(y * layers);
  float lon = atan(p.z, p.x) / 6.28318 + 0.5;
  float direction = mod(id, 2.0) < 1.0 ? 1.0 : -1.0;
  float speed = 0.03 + hash11(id + uSeed) * 0.07;
  float seg = fract(lon * (8.0 + id * 2.0) + t * speed * direction);
  float packet = smoothstep(0.0, 0.05, seg) * (1.0 - smoothstep(0.42, 0.5, seg));
  float layer = smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.86, 1.0, f));
  float seam = exp(-pow((f - 0.5) * 6.5, 2.0));
  vec3 color = uColor * (0.14 + 0.55 * layer) + uGlow * packet * seam * layer * 1.4;
  float ring = exp(-pow((p.y - (fract(t * 0.11) * 2.6 - 1.3)) * 11.0, 2.0));
  color += uGlow * ring * 0.55;
  return color;
}
`;

/** Automation: molten metal under cooling crust plates, glowing cracks, a slow heat throb. */
export const forgeStyle = /* glsl */ `
vec3 coreStyle(vec3 p, vec3 n, vec3 v, float t) {
#ifdef LOW_QUALITY
  float heat = 0.5 + 0.5 * sin(p.x * 7.0 + t * 0.6) * sin(p.y * 6.0 - t * 0.4);
  float crack = smoothstep(0.85, 1.0, abs(sin(p.x * 11.0 + p.z * 9.0)));
#else
  vec3 q = p * 2.4;
  vec3 warp = vec3(snoise(q + t * 0.11), snoise(q + 4.1 - t * 0.09), snoise(q - 2.3));
  float heat = snoise(q * 1.3 + warp * 0.9 + vec3(0.0, t * 0.14, uSeed)) * 0.5 + 0.5;
  vec3 cell;
  vec2 d = voronoi3(p * 3.0 + warp * 0.12, cell);
  float crack = 1.0 - smoothstep(0.015, 0.11, d.y - d.x);
#endif
  vec3 whiteHot = mix(uGlow, vec3(1.0, 0.95, 0.85), 0.4) * 1.9;
  vec3 molten = mix(uColor * 1.1, whiteHot, smoothstep(0.6, 1.0, heat));
  vec3 crust = uColor * 0.07 + vec3(0.03, 0.02, 0.018);
  vec3 color = mix(crust, molten, max(crack, smoothstep(0.58, 0.88, heat)));
  return color * (0.9 + 0.14 * sin(t * 2.1 + uSeed));
}
`;

/** AI: an iridescent fluid mass (the vertex shader swells it) threaded with firing synapses. */
export const neuralStyle = /* glsl */ `
vec3 coreStyle(vec3 p, vec3 n, vec3 v, float t) {
  float facing = clamp(dot(n, v), 0.0, 1.0);
#ifdef LOW_QUALITY
  float flow = 0.5 + 0.5 * sin(p.x * 5.0 + p.y * 4.0 + t * 0.5);
  float ridge = pow(1.0 - abs(sin(p.y * 8.0 + p.z * 6.0 + t * 0.4)), 10.0);
#else
  float flow = snoise(p * 2.0 + vec3(t * 0.2, uSeed, -t * 0.15)) * 0.5 + 0.5;
  float ridge = pow(1.0 - abs(snoise(p * 4.2 + vec3(-t * 0.3, t * 0.2, uSeed))), 10.0);
#endif
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (flow * 0.9 + facing * 0.7 + vec3(0.0, 0.33, 0.67)));
  vec3 color = mix(uColor * 0.22, uColor, flow) * (0.55 + 0.65 * film) + uGlow * ridge * 1.6;
  float spark = step(0.982, hash13(floor(p * 16.0) + floor(t * 3.0)));
  return color + uGlow * spark * (0.4 + ridge) * 2.0;
}
`;

/** Telegram: an icy nucleus with jets streaming toward the tail (the tail itself is a particle layer). */
export const cometStyle = /* glsl */ `
vec3 coreStyle(vec3 p, vec3 n, vec3 v, float t) {
#ifdef LOW_QUALITY
  float ice = 0.5 + 0.5 * sin(p.y * 9.0 + p.z * 7.0 + t * 0.3);
  float jets = pow(max(-p.x, 0.0), 2.0);
#else
  vec3 q = vec3(p.x * 0.55 + t * 0.4, p.y, p.z);
  float ice = snoise(q * 3.0 + uSeed) * 0.5 + 0.5;
  float jets = pow(max(-p.x, 0.0), 2.0) * (0.45 + 0.55 * snoise(vec3(p.y * 6.0, p.z * 6.0, t * 1.2)));
#endif
  vec3 color = mix(uColor * 0.35, mix(uGlow, vec3(1.0), 0.3), ice * ice);
  color += uGlow * jets * 1.5;
  // Bright sunward cap.
  color += mix(uColor, uGlow, 0.6) * pow(max(p.x, 0.0), 3.0) * 0.6;
  return color * (0.92 + 0.1 * sin(t * 3.1 + uSeed));
}
`;
