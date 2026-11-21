'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Vector2, Vector3, type Mesh, type ShaderMaterial } from 'three';
import { PALETTE } from '../config';
import { qualityDefines, type QualityPreset } from '../quality';
import { backdropFragment, backdropVertex } from '../shaders/backdrop';
import { BAND_ROTATION } from './Starfield';

/** Sky sphere radius: inside the far plane, beyond every star layer's reach. */
const SKY_RADIUS = 420;
/** Dust lane strength (sRGB units added at the lane's core). */
const DUST_AMOUNT = 0.034;

interface BackdropProps {
  preset: QualityPreset;
}

/**
 * The cosmos backdrop inside the (opaque) canvas, matching the CSS
 * `.backdrop-cosmos` it fades in over; see shaders/backdrop.ts and DECISIONS
 * (bloom needs a real background to composite on, and an opaque canvas
 * composites identically in every browser). Colours are read from the CSS
 * tokens, so the two backdrops cannot drift apart.
 */
export function Backdrop({ preset }: BackdropProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(() => {
    const colors = readBackdropColors();
    const dust = colors.nebula.clone().lerp(colors.brand, 0.35).multiplyScalar(DUST_AMOUNT);
    return {
      uResolution: { value: new Vector2(1, 1) },
      uVoid: { value: colors.void },
      uDeep: { value: colors.deep },
      uNebula: { value: colors.nebula },
      uBrand: { value: colors.brand },
      uDust: { value: dust },
      uBandNormal: { value: new Vector3(0, 1, 0).applyEuler(BAND_ROTATION) },
    };
  }, []);

  useFrame((state) => {
    meshRef.current?.position.copy(state.camera.position);
    const material = materialRef.current;
    if (material) state.gl.getDrawingBufferSize(material.uniforms.uResolution.value as Vector2);
  });

  return (
    <mesh ref={meshRef} scale={SKY_RADIUS} frustumCulled={false} renderOrder={-100}>
      <icosahedronGeometry args={[1, preset.lowQualityShaders ? 2 : 4]} />
      <shaderMaterial
        key={preset.lowQualityShaders ? 'low' : 'full'}
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={backdropVertex}
        fragmentShader={backdropFragment}
        defines={qualityDefines(preset)}
        side={BackSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

interface BackdropColors {
  void: Vector3;
  deep: Vector3;
  nebula: Vector3;
  brand: Vector3;
}

/** sRGB (0..1) colours of the CSS backdrop tokens, with scene fallbacks. */
function readBackdropColors(): BackdropColors {
  const style = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const probe =
    typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const read = (token: string, fallback: string): Vector3 => {
    const raw = style?.getPropertyValue(token).trim() ?? '';
    return parseCssColor(raw, probe) ?? parseCssColor(fallback, null)!;
  };
  return {
    void: read('--color-void', PALETTE.void),
    deep: read('--color-deep', PALETTE.deep),
    nebula: read('--color-nebula', PALETTE.backdropNebula),
    brand: read('--color-brand', PALETTE.backdropBrand),
  };
}

/** Parses any CSS colour (normalized by a 2D context when available) into sRGB 0..1. */
function parseCssColor(value: string, probe: CanvasRenderingContext2D | null): Vector3 | null {
  if (!value) return null;
  let normalized = value;
  if (probe) {
    probe.fillStyle = '#000000';
    probe.fillStyle = value;
    normalized = String(probe.fillStyle);
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(normalized);
  if (rgb) return new Vector3(+rgb[1]! / 255, +rgb[2]! / 255, +rgb[3]! / 255);
  return null;
}
