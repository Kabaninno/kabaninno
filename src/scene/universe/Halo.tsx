'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, type ShaderMaterial } from 'three';
import { qualityDefines, type QualityPreset } from '../quality';
import { haloFragment, haloVertex } from '../shaders/halo';
import { fogUniforms } from '../three-utils';
import { neighbourDim, type UniverseRuntimeRef } from './runtime';

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
  /** Fade out when the camera dives into this node (its system corona takes over). */
  fadeOnFocus?: boolean;
}

/**
 * Soft additive glow around a node; brightens with the node's emphasis and
 * dims while the camera focuses another node.
 */
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
  fadeOnFocus = false,
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
    if (!material || !rt) return;
    material.uniforms.uEmphasis.value = rt.emphasis[index] ?? 0;
    const focusFade = fadeOnFocus ? 1 - 0.8 * (rt.focus[index] ?? 0) : 1;
    material.uniforms.uIntensity.value =
      intensity * neighbourDim(rt, index) * focusFade * (rt.presence[index] ?? 1);
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
