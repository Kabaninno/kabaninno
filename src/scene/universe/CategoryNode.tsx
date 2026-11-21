'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group, type Mesh, type ShaderMaterial } from 'three';
import { SYSTEM_BASE_TILT } from '../config';
import { qualityDefines, type QualityPreset } from '../quality';
import { nodeCoreFragment, nodeCoreVertex } from '../shaders/node-core';
import { fogUniforms } from '../three-utils';
import { Halo } from './Halo';
import { HitZone } from './HitZone';
import type { CategoryNodeModel } from './model';
import { NodeOrbits } from './NodeOrbits';
import type { UniverseRuntimeRef } from './runtime';

/** Visual radius of a category core in the universe, world units. */
export const NODE_CORE_RADIUS = 0.34;

interface CategoryNodeProps {
  node: CategoryNodeModel;
  runtime: UniverseRuntimeRef;
  preset: QualityPreset;
  onNavigate: (path: string) => void;
}

/**
 * A category "neuron": energy core + additive halo + orbit preview of its
 * services + invisible enlarged hit sphere. Colors come from the category DNA.
 */
export function CategoryNode({ node, runtime, preset, onNavigate }: CategoryNodeProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const coreMaterialRef = useRef<ShaderMaterial>(null);

  const coreUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uColor: { value: new Color(node.color) },
      uGlow: { value: new Color(node.glow) },
      uTime: { value: 0 },
      uEmphasis: { value: 0 },
      uSeed: { value: node.index * 3.7 },
    }),
    [node.color, node.glow, node.index],
  );

  useFrame(() => {
    const rt = runtime.current;
    if (!rt) return;
    const group = groupRef.current;
    if (group) {
      const offset = rt.offsets[node.index];
      group.position.set(node.position[0], node.position[1], node.position[2]);
      if (offset) group.position.add(offset);
    }
    const emphasis = rt.emphasis[node.index] ?? 0;
    const core = coreRef.current;
    if (core) {
      core.rotation.y = rt.time * 0.12;
      core.scale.setScalar(1 + 0.12 * emphasis);
    }
    const material = coreMaterialRef.current;
    if (material) {
      material.uniforms.uTime.value = rt.time;
      material.uniforms.uEmphasis.value = emphasis;
    }
  });

  const hitRadius = Math.max(node.systemRadius * 1.15, 1.7);

  return (
    <group ref={groupRef} position={node.position}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[NODE_CORE_RADIUS, preset.lowQualityShaders ? 3 : 5]} />
        <shaderMaterial
          key={preset.lowQualityShaders ? 'low' : 'full'}
          ref={coreMaterialRef}
          uniforms={coreUniforms}
          vertexShader={nodeCoreVertex}
          fragmentShader={nodeCoreFragment}
          defines={qualityDefines(preset)}
        />
      </mesh>
      <Halo
        color={node.color}
        glow={node.glow}
        size={2.1}
        lift={NODE_CORE_RADIUS * 1.1}
        intensity={0.95}
        runtime={runtime}
        index={node.index}
        preset={preset}
      />
      <group rotation={[SYSTEM_BASE_TILT, 0, 0]}>
        <NodeOrbits
          orbits={node.orbits}
          color={node.glow}
          runtime={runtime}
          index={node.index}
          preset={preset}
        />
      </group>
      <HitZone radius={hitRadius} nodeKey={node.key} path={node.path} onNavigate={onNavigate} />
    </group>
  );
}
