'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import type { BloomEffect, EffectComposer as ComposerImpl } from 'postprocessing';
import { HalfFloatType } from 'three';
import type { SceneBusRef } from '../bus';
import type { QualityPreset } from '../quality';

/**
 * Bloom tuned for the "Signal Cosmos" look: the scene renders into a linear
 * half-float target, so only HDR values (core centres > 1, impulses, the
 * brightest stars) cross the threshold and lines stay crisp. The arrival
 * flash of a dive (bus `flash`, GSAP-driven) lifts the intensity briefly.
 */
export const BLOOM = {
  /** Above every DNA colour's own luminance (teal ≈ 0.69 linear): only HDR blooms. */
  threshold: 0.9,
  smoothing: 0.3,
  intensity: 1.05,
  radius: 0.72,
  /** Extra intensity at the flash peak, relative to the base. */
  flashGain: 1.6,
} as const;

interface EffectsProps {
  preset: QualityPreset;
  busRef: SceneBusRef;
  /** The composer has rendered (and compiled its passes): the boot may continue. */
  onReady?: () => void;
}

/**
 * Loaded lazily in its own chunk (postprocessing is ~120 KiB raw) and mounted
 * as its own boot stage, before the universe: the universe then compiles
 * straight for the composer's linear target (perf P-01b).
 */
export function Effects({ preset, busRef, onReady }: EffectsProps) {
  const bloomRef = useRef<BloomEffect>(null);
  const composerRef = useRef<ComposerImpl>(null);
  const framesRef = useRef(0);

  useFrame(() => {
    const bloom = bloomRef.current;
    if (bloom) bloom.intensity = BLOOM.intensity * (1 + BLOOM.flashGain * busRef.current.flash);
    // Ready after two composer frames with the bloom pass in place.
    const composer = composerRef.current;
    if (onReady && framesRef.current < 2 && composer && composer.passes.length > 1) {
      framesRef.current += 1;
      if (framesRef.current === 2) onReady();
    }
  });

  if (!preset.bloom) return null;
  return (
    <EffectComposer
      ref={composerRef}
      multisampling={preset.bloom.multisampling}
      frameBufferType={HalfFloatType}
      enableNormalPass={false}
    >
      <Bloom
        ref={bloomRef}
        mipmapBlur
        luminanceThreshold={BLOOM.threshold}
        luminanceSmoothing={BLOOM.smoothing}
        intensity={BLOOM.intensity}
        radius={BLOOM.radius}
        levels={preset.bloom.levels}
      />
    </EffectComposer>
  );
}

export default Effects;
