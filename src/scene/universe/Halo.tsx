'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, type ShaderMaterial } from 'three';
import { qualityDefines, type QualityPreset } from '../quality';
import { haloFragment, haloVertex } from '../shaders/halo';
import { fogUniforms } from '../three-utils';
import type { UniverseRuntimeRef } from './runtime';

interface HaloProps {
  color: string;
  glow: string;
  /** Half size of the billboard, world units. */
  size: number;
  /** Shift toward the camera (usually the core radius) so the glow blooms over it. */
  lift: number;
  intensity: number;
  runtime: UniverseRuntimeRef;
  index: number;
  preset: QualityPreset;
  /** Optional handle for parents that animate colors (e.g. the beacon). */
  materialRef?: RefObject<ShaderMaterial | null>;
}

/** Soft additive glow around a node; brightens with the node's emphasis. */
export function Halo({
  color,
  glow,
  size,
  lift,
  intensity,
  runtime,
  index,
  preset,
  materialRef,
}: HaloProps) {
  const localRef = useRef<ShaderMaterial>(null);
  const ref = materialRef ?? localRef;

  const uniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uColor: { value: new Color(color) },
      uGlow: { value: new Color(glow) },
      uSize: { value: size },
      uLift: { value: lift },
      uIntensity: { value: intensity },
      uEmphasis: { value: 0 },
    }),
    [color, glow, size, lift, intensity],
  );

  useFrame(() => {
    const material = ref.current;
    const rt = runtime.current;
    if (material && rt) material.uniforms.uEmphasis.value = rt.emphasis[index] ?? 0;
  });

  return (
    <mesh frustumCulled={false} renderOrder={2}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        key={preset.lowQualityShaders ? 'low' : 'full'}
        ref={ref}
        uniforms={uniforms}
        vertexShader={haloVertex}
        fragmentShader={haloFragment}
        defines={qualityDefines(preset)}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
