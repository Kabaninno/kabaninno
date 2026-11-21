'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, type ShaderMaterial } from 'three';
import { orbitPosition } from '../orbit-math';
import { qualityDefines, type QualityPreset } from '../quality';
import {
  orbitLineFragment,
  orbitLineVertex,
  orbitSparkFragment,
  orbitSparkVertex,
} from '../shaders/orbits';
import { fogUniforms, pointScale } from '../three-utils';
import type { OrbitPreview } from './model';
import type { UniverseRuntimeRef } from './runtime';

/** Sparks are drawn larger than the real planet so they read from afar. */
const SPARK_EXAGGERATION = 2.6;

interface NodeOrbitsProps {
  orbits: readonly OrbitPreview[];
  color: string;
  runtime: UniverseRuntimeRef;
  index: number;
  preset: QualityPreset;
}

/**
 * Data-driven preview of the nested planetary system: one orbit line and one
 * moving spark per service, using the real orbit parameters at system scale.
 * Two draw calls per node regardless of the number of services.
 */
export function NodeOrbits({ orbits, color, runtime, index, preset }: NodeOrbitsProps) {
  const lineRef = useRef<ShaderMaterial>(null);
  const sparkRef = useRef<ShaderMaterial>(null);

  const lines = useMemo(() => buildOrbitLines(orbits, preset.orbitSegments), [orbits, preset]);
  const sparks = useMemo(() => buildSparks(orbits), [orbits]);

  const lineUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uColor: { value: new Color(color) },
      uTime: { value: 0 },
      uEmphasis: { value: 0 },
      uOpacity: { value: 0.85 },
    }),
    [color],
  );
  const sparkUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uTime: { value: 0 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
      uEmphasis: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const rt = runtime.current;
    if (!rt) return;
    const emphasis = rt.emphasis[index] ?? 0;
    const line = lineRef.current;
    if (line) {
      line.uniforms.uTime.value = rt.time;
      line.uniforms.uEmphasis.value = emphasis;
    }
    const spark = sparkRef.current;
    if (spark) {
      spark.uniforms.uTime.value = rt.time;
      spark.uniforms.uEmphasis.value = emphasis;
      spark.uniforms.uScale.value = pointScale(state);
      spark.uniforms.uPixelRatio.value = state.viewport.dpr;
    }
  });

  const defines = qualityDefines(preset);
  const variant = preset.lowQualityShaders ? 'low' : 'full';

  return (
    <>
      <lineSegments frustumCulled={false} renderOrder={1}>
        <bufferGeometry key={`lines-${lines.count}`}>
          <bufferAttribute attach="attributes-position" args={[lines.positions, 3]} />
          <bufferAttribute attach="attributes-aAngle" args={[lines.angles, 1]} />
          <bufferAttribute attach="attributes-aSpeed" args={[lines.speeds, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[lines.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          key={variant}
          ref={lineRef}
          uniforms={lineUniforms}
          vertexShader={orbitLineVertex}
          fragmentShader={orbitLineFragment}
          defines={defines}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </lineSegments>
      <points frustumCulled={false} renderOrder={3}>
        <bufferGeometry key={`sparks-${sparks.count}`}>
          <bufferAttribute attach="attributes-position" args={[sparks.positions, 3]} />
          <bufferAttribute attach="attributes-aRadius" args={[sparks.radius, 1]} />
          <bufferAttribute attach="attributes-aTilt" args={[sparks.tilt, 1]} />
          <bufferAttribute attach="attributes-aYaw" args={[sparks.yaw, 1]} />
          <bufferAttribute attach="attributes-aSpeed" args={[sparks.speed, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[sparks.phase, 1]} />
          <bufferAttribute attach="attributes-aSize" args={[sparks.size, 1]} />
          <bufferAttribute attach="attributes-aColor" args={[sparks.color, 3]} />
        </bufferGeometry>
        <shaderMaterial
          key={variant}
          ref={sparkRef}
          uniforms={sparkUniforms}
          vertexShader={orbitSparkVertex}
          fragmentShader={orbitSparkFragment}
          defines={defines}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </>
  );
}

function buildOrbitLines(orbits: readonly OrbitPreview[], segments: number) {
  const vertexCount = orbits.length * segments * 2;
  const positions = new Float32Array(vertexCount * 3);
  const angles = new Float32Array(vertexCount);
  const speeds = new Float32Array(vertexCount);
  const phases = new Float32Array(vertexCount);
  const point = { x: 0, y: 0, z: 0 };
  let v = 0;
  for (const orbit of orbits) {
    for (let s = 0; s < segments; s++) {
      for (const step of [s, s + 1]) {
        // Unwrapped angle (last vertex = 2π) keeps the varying continuous.
        const angle = (step / segments) * Math.PI * 2;
        orbitPosition(orbit, angle, point);
        positions[v * 3] = point.x;
        positions[v * 3 + 1] = point.y;
        positions[v * 3 + 2] = point.z;
        angles[v] = angle;
        speeds[v] = orbit.speed;
        phases[v] = orbit.phase;
        v++;
      }
    }
  }
  return { positions, angles, speeds, phases, count: vertexCount };
}

function buildSparks(orbits: readonly OrbitPreview[]) {
  const count = orbits.length;
  const color = new Float32Array(count * 3);
  const tint = new Color();
  orbits.forEach((orbit, i) => {
    tint.set(orbit.color);
    color[i * 3] = tint.r;
    color[i * 3 + 1] = tint.g;
    color[i * 3 + 2] = tint.b;
  });
  return {
    count,
    // Positions are computed in the vertex shader; the attribute only sets the count.
    positions: new Float32Array(count * 3),
    radius: Float32Array.from(orbits, (orbit) => orbit.radius),
    tilt: Float32Array.from(orbits, (orbit) => orbit.tilt),
    yaw: Float32Array.from(orbits, (orbit) => orbit.yaw),
    speed: Float32Array.from(orbits, (orbit) => orbit.speed),
    phase: Float32Array.from(orbits, (orbit) => orbit.phase),
    size: Float32Array.from(orbits, (orbit) => orbit.size * SPARK_EXAGGERATION),
    color,
  };
}
