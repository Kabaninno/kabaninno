'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Vector3, type ShaderMaterial } from 'three';
import { MAX_UNIVERSE_NODES } from '../config';
import { qualityDefines, type QualityPreset } from '../quality';
import { linksFragment, linksVertex } from '../shaders/links';
import { fogUniforms } from '../three-utils';
import type { Vec3 } from '../types';
import type { UniverseModel } from './model';
import type { UniverseRuntimeRef } from './runtime';

interface LinksProps {
  model: UniverseModel;
  runtime: UniverseRuntimeRef;
  preset: QualityPreset;
}

/**
 * Thin network lines between nodes ("integrations") with travelling data
 * impulses. One draw call for the whole network. Links attached to the
 * highlighted node brighten (emphasis is read per endpoint on the GPU).
 */
export function Links({ model, runtime, preset }: LinksProps) {
  const materialRef = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => buildLinks(model, preset.linkSegments), [model, preset]);

  const uniforms = useMemo(
    () => ({
      ...fogUniforms(),
      // Replaced by the runtime arrays (bound by reference) on the first frame.
      uOffsets: { value: Array.from({ length: MAX_UNIVERSE_NODES }, () => new Vector3()) },
      uEmphasis: { value: new Array<number>(MAX_UNIVERSE_NODES).fill(0) },
      uTime: { value: 0 },
      uNetwork: { value: 1 },
      uPulses: { value: 1 },
    }),
    [],
  );

  useFrame(() => {
    const material = materialRef.current;
    const rt = runtime.current;
    if (!material || !rt) return;
    // The runtime updates these arrays in place, so binding is copy-free.
    material.uniforms.uOffsets.value = rt.offsets;
    material.uniforms.uEmphasis.value = rt.emphasis;
    material.uniforms.uTime.value = rt.time;
    material.uniforms.uNetwork.value = rt.network;
    material.uniforms.uPulses.value = rt.animated ? 1 : 0;
  });

  if (geometry.count === 0) return null;

  return (
    <lineSegments frustumCulled={false} renderOrder={0}>
      <bufferGeometry key={`links-${geometry.count}`}>
        <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
        <bufferAttribute attach="attributes-aT" args={[geometry.t, 1]} />
        <bufferAttribute attach="attributes-aA" args={[geometry.a, 1]} />
        <bufferAttribute attach="attributes-aB" args={[geometry.b, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[geometry.seed, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[geometry.color, 3]} />
      </bufferGeometry>
      <shaderMaterial
        key={preset.lowQualityShaders ? 'low' : 'full'}
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={linksVertex}
        fragmentShader={linksFragment}
        defines={{ ...qualityDefines(preset), MAX_NODES: String(MAX_UNIVERSE_NODES) }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </lineSegments>
  );
}

/** Bakes every link as a gently bowed quadratic curve split into line segments. */
function buildLinks(model: UniverseModel, segments: number) {
  const vertexCount = model.links.length * segments * 2;
  const positions = new Float32Array(vertexCount * 3);
  const t = new Float32Array(vertexCount);
  const a = new Float32Array(vertexCount);
  const b = new Float32Array(vertexCount);
  const seed = new Float32Array(vertexCount);
  const color = new Float32Array(vertexCount * 3);
  const colorA = new Color();
  const colorB = new Color();
  const mixed = new Color();
  let v = 0;

  for (const link of model.links) {
    const start = model.nodes[link.a]!;
    const end = model.nodes[link.b]!;
    colorA.set(start.color);
    colorB.set(end.color);
    const control = bowControlPoint(start.position, end.position);
    for (let s = 0; s < segments; s++) {
      for (const step of [s, s + 1]) {
        const u = step / segments;
        const inv = 1 - u;
        for (let axis = 0; axis < 3; axis++) {
          positions[v * 3 + axis] =
            inv * inv * start.position[axis]! +
            2 * inv * u * control[axis]! +
            u * u * end.position[axis]!;
        }
        mixed.copy(colorA).lerp(colorB, u);
        color[v * 3] = mixed.r;
        color[v * 3 + 1] = mixed.g;
        color[v * 3 + 2] = mixed.b;
        t[v] = u;
        a[v] = link.a;
        b[v] = link.b;
        seed[v] = link.seed;
        v++;
      }
    }
  }
  return { positions, t, a, b, seed, color, count: vertexCount };
}

/** Control point lifted away from the universe centre and slightly upward. */
function bowControlPoint(start: Vec3, end: Vec3): Vec3 {
  const mid: Vec3 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2];
  const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  const outward = Math.hypot(mid[0], mid[2]) || 1;
  const bow = length * 0.09;
  return [
    mid[0] + (mid[0] / outward) * bow,
    mid[1] + length * 0.05,
    mid[2] + (mid[2] / outward) * bow,
  ];
}
