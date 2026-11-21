'use client';

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Euler, Vector3, type Group, type ShaderMaterial } from 'three';
import { qualityDefines, type QualityPreset } from '../quality';
import { createRandom } from '../random';
import { starfieldFragment, starfieldVertex } from '../shaders/starfield';
import { motionTime, pointScale } from '../three-utils';

interface StarLayerConfig {
  id: string;
  seed: number;
  /** Shell radii, world units. */
  minRadius: number;
  maxRadius: number;
  /** Apparent size range in px (at a 1000 px tall viewport). */
  minPx: number;
  maxPx: number;
  /**
   * How much the layer follows the camera (0 = fixed in space, 1 = skybox).
   * Far layers follow more, which yields gentle depth parallax and keeps stars
   * unreachable however far the camera travels.
   */
  follow: number;
  /** Share of stars concentrated in a faint galactic band. */
  band: number;
  brightness: number;
  twinkle: number;
  /** Slow drift around the vertical axis, rad/s. */
  spin: number;
}

/** Ordered like QualityPreset.starCounts: far, mid, near. */
const LAYERS: readonly StarLayerConfig[] = [
  {
    id: 'far',
    seed: 0xa11ce,
    minRadius: 190,
    maxRadius: 290,
    minPx: 0.7,
    maxPx: 2.0,
    follow: 0.94,
    band: 0.42,
    brightness: 0.8,
    twinkle: 0.28,
    spin: 0.0016,
  },
  {
    id: 'mid',
    seed: 0xb0b,
    minRadius: 105,
    maxRadius: 175,
    minPx: 0.9,
    maxPx: 2.6,
    follow: 0.74,
    band: 0.3,
    brightness: 0.9,
    twinkle: 0.36,
    spin: 0.0024,
  },
  {
    id: 'near',
    seed: 0xc0ffee,
    minRadius: 52,
    maxRadius: 92,
    minPx: 1.1,
    maxPx: 3.4,
    follow: 0.45,
    band: 0.12,
    brightness: 1,
    twinkle: 0.45,
    spin: 0.0034,
  },
];

const STAR_TINTS = [
  { color: '#E8ECF5', weight: 0.62 },
  { color: '#A9C6FF', weight: 0.24 },
  { color: '#CFE0FF', weight: 0.08 },
  { color: '#FFD9B5', weight: 0.06 },
] as const;

/** Tilt of the galactic band. */
const BAND_ROTATION = new Euler(0.42, 0, 0.36);

interface StarfieldProps {
  preset: QualityPreset;
  reducedMotion: boolean;
}

/** Seeded starfield in three depth layers with camera-relative parallax. */
export const Starfield = memo(function Starfield({ preset, reducedMotion }: StarfieldProps) {
  return (
    <>
      {LAYERS.map((layer, i) => (
        <StarLayer
          key={layer.id}
          layer={layer}
          count={preset.starCounts[i] ?? 0}
          preset={preset}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
});

interface StarLayerProps {
  layer: StarLayerConfig;
  count: number;
  preset: QualityPreset;
  reducedMotion: boolean;
}

function StarLayer({ layer, count, preset, reducedMotion }: StarLayerProps) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const data = useMemo(() => generateStars(layer, count), [layer, count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
      uTwinkle: { value: layer.twinkle },
      uBrightness: { value: layer.brightness },
    }),
    [layer],
  );

  useFrame((state) => {
    const time = motionTime(state, reducedMotion);
    const group = groupRef.current;
    if (group) {
      group.position.copy(state.camera.position).multiplyScalar(layer.follow);
      group.rotation.y = time * layer.spin;
    }
    const material = materialRef.current;
    if (material) {
      material.uniforms.uTime.value = time;
      material.uniforms.uScale.value = pointScale(state);
      material.uniforms.uPixelRatio.value = state.viewport.dpr;
    }
  });

  if (count <= 0) return null;

  return (
    <group ref={groupRef}>
      <points frustumCulled={false} renderOrder={-10}>
        <bufferGeometry key={`stars-${count}`}>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
          <bufferAttribute attach="attributes-aColor" args={[data.colors, 3]} />
        </bufferGeometry>
        <shaderMaterial
          key={preset.lowQualityShaders ? 'low' : 'full'}
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={starfieldVertex}
          fragmentShader={starfieldFragment}
          defines={qualityDefines(preset)}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  );
}

function generateStars(layer: StarLayerConfig, count: number) {
  const random = createRandom(layer.seed);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const direction = new Vector3();
  const tint = new Color();
  const tints = STAR_TINTS.map((entry) => ({
    color: new Color(entry.color),
    weight: entry.weight,
  }));

  for (let i = 0; i < count; i++) {
    // Uniform direction on the sphere…
    const cosTheta = random() * 2 - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const phi = random() * Math.PI * 2;
    direction.set(Math.cos(phi) * sinTheta, cosTheta, Math.sin(phi) * sinTheta);
    // …a share of it squeezed into a tilted galactic band.
    if (random() < layer.band) {
      direction.y *= 0.14;
      direction.normalize().applyEuler(BAND_ROTATION);
    }
    const radius = layer.minRadius + random() * (layer.maxRadius - layer.minRadius);
    positions[i * 3] = direction.x * radius;
    positions[i * 3 + 1] = direction.y * radius;
    positions[i * 3 + 2] = direction.z * radius;

    // Power-law brightness: many faint stars, few bright ones.
    const px = layer.minPx + Math.pow(random(), 3.2) * (layer.maxPx - layer.minPx);
    sizes[i] = (px * radius) / 1000;
    phases[i] = random();

    let pick = random();
    tint.copy(tints[0]!.color);
    for (const entry of tints) {
      if (pick < entry.weight) {
        tint.copy(entry.color);
        break;
      }
      pick -= entry.weight;
    }
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  return { positions, sizes, phases, colors };
}
