import { fogChunk, fresnelChunk, simplexNoise3d } from './chunks';

/**
 * Shared pieces of the system-view shaders (planets, moons, shells, rings).
 * Everything is lit by the system's core (`uCorePos`, world space): planets
 * get a lit and a night side, rim light and reflections of a procedural
 * environment whose "sun" is the core — no flat lighting, no default
 * materials.
 */

/** Hash helpers (Dave Hoskins, MIT). */
export const hashChunk = /* glsl */ `
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
`;

/**
 * 3D Voronoi: x = distance to the nearest feature point, y = to the second,
 * `cell` = the nearest feature point (cell id / facet direction).
 */
export const voronoiChunk = /* glsl */ `
vec2 voronoi3(vec3 g, out vec3 cell) {
  vec3 ip = floor(g);
  vec3 fp = fract(g);
  float d1 = 8.0;
  float d2 = 8.0;
  cell = ip;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 h = hash33(ip + o);
        vec3 r = o + h - fp;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          cell = ip + o + h;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
`;

/**
 * Planet / moon vertex shader. DEFORM displaces along the normal with
 * animated noise (the "blob" shape) and re-derives the normal from two
 * neighbouring samples. Instanced meshes (moons) apply `instanceMatrix`.
 */
export const planetVertex = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uDeform;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vObjPos;
varying float vDepth;

#ifdef DEFORM
${simplexNoise3d}
vec3 displaced(vec3 p) {
  vec3 d = normalize(p);
  // Low-frequency swell: a fluid mass, not crumpled foil.
  float n = snoise(d * 1.15 + vec3(uSeed, uTime * 0.2, -uTime * 0.15));
  n += 0.22 * snoise(d * 2.3 + vec3(-uTime * 0.27, uSeed, uTime * 0.18));
  return p + d * n * uDeform;
}
#endif

void main() {
  vec3 pos = position;
  vec3 nrm = normal;
#ifdef DEFORM
  vec3 tangent = normalize(cross(abs(nrm.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), nrm));
  vec3 bitangent = cross(nrm, tangent);
  vec3 p0 = displaced(pos);
  vec3 p1 = displaced(pos + tangent * 0.02);
  vec3 p2 = displaced(pos + bitangent * 0.02);
  nrm = normalize(cross(p1 - p0, p2 - p0));
  if (dot(nrm, normal) < 0.0) nrm = -nrm;
  pos = p0;
#endif
  vec4 local = vec4(pos, 1.0);
#ifdef USE_INSTANCING
  local = instanceMatrix * local;
  nrm = mat3(instanceMatrix) * nrm;
#endif
  vObjPos = pos;
  vec4 world = modelMatrix * local;
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * nrm);
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

/** Uniforms, environment and lighting helpers for planet fragment shaders. */
export const planetFragmentHead = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec3 uCorePos;
uniform vec3 uCoreColor;
uniform vec3 uFogColor;
uniform float uTime;
uniform float uSeed;
uniform float uHover;
uniform float uFade;
/** Siblings of a focused planet recede (1 = normal). */
uniform float uDim;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vObjPos;
varying float vDepth;

${fogChunk}
${fresnelChunk}

/** Procedural environment: deep space, a DNA-tinted horizon band, the core as the sun. */
vec3 envColor(vec3 dir, vec3 sunDir) {
  vec3 sky = mix(vec3(0.008, 0.011, 0.026), vec3(0.03, 0.045, 0.11), smoothstep(-0.5, 0.9, dir.y));
  sky += uColor * exp(-abs(dir.y) * 9.0) * 0.16;
  float sun = max(dot(dir, sunDir), 0.0);
  sky += uCoreColor * (pow(sun, 28.0) * 2.6 + pow(sun, 5.0) * 0.3);
  return sky;
}

struct Surface {
  vec3 n;
  vec3 v;
  vec3 l;
  float facing;
  float light;
};

Surface surface() {
  Surface s;
  s.n = normalize(vWorldNormal);
  if (!gl_FrontFacing) s.n = -s.n;
  s.v = normalize(cameraPosition - vWorldPos);
  s.l = normalize(uCorePos - vWorldPos);
  s.facing = clamp(dot(s.n, s.v), 0.0, 1.0);
  // Wrapped diffuse from the core: a soft terminator, never pitch black.
  s.light = clamp((dot(s.n, s.l) + 0.35) / 1.35, 0.0, 1.0);
  return s;
}

/** Opaque output with depth fog. */
vec4 finishOpaque(vec3 color) {
  return vec4(mix(uFogColor, color, fogFactor(vDepth) * uDim), 1.0);
}

/** Transparent output with depth fog folded into alpha. */
vec4 finishTransparent(vec3 color, float alpha) {
  return vec4(color, clamp(alpha * fogFactor(vDepth) * uFade * uDim, 0.0, 1.0));
}
`;
