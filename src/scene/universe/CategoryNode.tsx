'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group, type Mesh, type ShaderMaterial } from 'three';
import type { SceneBusRef } from '../bus';
import { SYSTEM_BASE_TILT } from '../config';
import { systemPrewarmKey, type CompileApiRef, type PrewarmApiRef } from '../prewarm/api';
import { COMPILE_PRIORITY } from '../prewarm/compile-queue';
import type { SystemMaterialCache } from '../prewarm/system-materials';
import { qualityDefines, type QualityPreset } from '../quality';
import { nodeCoreFragment, nodeCoreVertex } from '../shaders/node-core';
import {
  NODE_CORE_RADIUS,
  SYSTEM_DETAIL_EPSILON,
  SystemContent,
  systemDetail,
} from '../system/SystemContent';
import { fogUniforms } from '../three-utils';
import { Halo } from './Halo';
import { HitZone } from './HitZone';
import type { CategoryNodeModel } from './model';
import { NodeOrbits } from './NodeOrbits';
import { neighbourDim, type UniverseRuntimeRef } from './runtime';
import { orbitClearanceScale } from './screen-size';

/** Halo half size and lift relative to the core radius. */
const HALO_SIZE = 6.2;
const HALO_LIFT = 1.1;
const HALO_INTENSITY = 0.95;
/** Minimum hit zone diameter on screen (touch target), CSS px. */
const MIN_HIT_PX = 44;

interface CategoryNodeProps {
  node: CategoryNodeModel;
  runtime: UniverseRuntimeRef;
  preset: QualityPreset;
  /** The URL focuses this category (system / planet). */
  focused: boolean;
  /** Slug of the planet the URL focuses in this category (planet route), else null. */
  focusedService: string | null;
  onNavigate: (path: string, replace?: boolean) => void;
  busRef: SceneBusRef;
  prewarm: PrewarmApiRef;
  compile: CompileApiRef;
  systemMaterials: SystemMaterialCache;
}

/**
 * A category "neuron": energy core + additive halo + orbit preview of its
 * services + invisible enlarged hit sphere. Colors come from the category DNA.
 *
 * Sizing (N-07, M3-04): the core keeps a minimum on-screen size for the
 * current framing (radius computed per frame by `Universe`); the orbit
 * preview widens just enough to clear an enlarged core, and the hit zone
 * covers the whole node with at least a 44 px touch target. While the URL
 * focuses the category (or the dive is under way) the system content is
 * mounted and takes over from the universe core up close.
 */
export function CategoryNode({
  node,
  runtime,
  preset,
  focused,
  focusedService,
  onNavigate,
  busRef,
  prewarm,
  compile,
  systemMaterials,
}: CategoryNodeProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const coreMaterialRef = useRef<ShaderMaterial>(null);
  const haloMaterialRef = useRef<ShaderMaterial>(null);
  const orbitGroupRef = useRef<Group>(null);
  const hitGroupRef = useRef<Group>(null);
  const systemReadyRef = useRef(false);
  const systemWanted = useRef(false);
  const [fading, setFading] = useState(false);

  const innermostOrbit = useMemo(
    () => node.orbits.reduce((min, orbit) => Math.min(min, orbit.radius), Infinity),
    [node.orbits],
  );

  const coreUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uColor: { value: new Color(node.color) },
      uGlow: { value: new Color(node.glow) },
      uTime: { value: 0 },
      uEmphasis: { value: 0 },
      uSeed: { value: node.index * 3.7 },
      uSmall: { value: 0 },
      uPresence: { value: 1 },
    }),
    [node.color, node.glow, node.index],
  );

  useFrame(() => {
    const rt = runtime.current;
    if (!rt) return;
    const i = node.index;
    const group = groupRef.current;
    if (group) {
      const offset = rt.offsets[i];
      group.position.set(node.position[0], node.position[1], node.position[2]);
      if (offset) group.position.add(offset);
    }
    const emphasis = rt.emphasis[i] ?? 0;
    const radius = rt.coreRadius[i] ?? NODE_CORE_RADIUS;
    const ppu = rt.pxPerUnit[i] ?? 1;

    const core = coreRef.current;
    if (core) {
      // Same-frame rule as SystemContent: exactly one of the two cores is drawn.
      const detail = systemDetail(rt.focus[i] ?? 0, rt.corePx[i] ?? 0);
      core.visible =
        !(systemReadyRef.current && detail > SYSTEM_DETAIL_EPSILON) && (rt.presence[i] ?? 1) > 0.02;
      core.rotation.y = rt.time * 0.12;
      core.scale.setScalar((radius / NODE_CORE_RADIUS) * (1 + 0.1 * emphasis));
    }
    const material = coreMaterialRef.current;
    if (material) {
      material.uniforms.uTime.value = rt.time;
      material.uniforms.uEmphasis.value = emphasis;
      material.uniforms.uSmall.value = rt.small[i] ?? 0;
      // Neighbours of the focused node step back with the network (mn4: no bare core).
      material.uniforms.uPresence.value = (rt.presence[i] ?? 1) * neighbourDim(rt, i, 0.4);
    }
    const halo = haloMaterialRef.current;
    if (halo) {
      halo.uniforms.uSize.value = radius * HALO_SIZE;
      halo.uniforms.uLift.value = radius * HALO_LIFT;
    }

    const orbitScale = orbitClearanceScale(radius, innermostOrbit);
    orbitGroupRef.current?.scale.setScalar(orbitScale);
    const hitRadius = Math.max(
      node.systemRadius * orbitScale * 1.1,
      radius * 2.6,
      MIN_HIT_PX / 2 / Math.max(ppu, 1e-3),
    );
    hitGroupRef.current?.scale.setScalar(hitRadius);

    // Keep the system content mounted while the dive (in or out) is visible.
    const wanted = (rt.focus[i] ?? 0) > 0.002;
    if (wanted !== systemWanted.current) {
      systemWanted.current = wanted;
      setFading(wanted);
    }
  });

  const showSystem = focused || fading;
  const variant = preset.lowQualityShaders ? 'low' : 'full';

  return (
    <group ref={groupRef} position={node.position}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[NODE_CORE_RADIUS, preset.coreDetail]} />
        <shaderMaterial
          key={variant}
          ref={coreMaterialRef}
          uniforms={coreUniforms}
          vertexShader={nodeCoreVertex}
          fragmentShader={nodeCoreFragment}
          defines={qualityDefines(preset)}
        />
      </mesh>
      {showSystem ? (
        <SystemContent
          node={node}
          preset={preset}
          materials={systemMaterials.get(node, preset.lowQualityShaders)}
          mode="live"
          runtime={runtime}
          compile={compile}
          busRef={busRef}
          focusedService={focusedService}
          onNavigate={onNavigate}
          readyRef={systemReadyRef}
          priority={focused ? COMPILE_PRIORITY.boot : COMPILE_PRIORITY.live}
        />
      ) : null}
      <Halo
        color={node.color}
        glow={node.glow}
        size={NODE_CORE_RADIUS * HALO_SIZE}
        lift={NODE_CORE_RADIUS * HALO_LIFT}
        intensity={HALO_INTENSITY}
        runtime={runtime}
        index={node.index}
        preset={preset}
        materialRef={haloMaterialRef}
        fadeOnFocus
      />
      <group rotation={[SYSTEM_BASE_TILT, 0, 0]}>
        <group ref={orbitGroupRef}>
          <NodeOrbits
            orbits={node.orbits}
            color={node.glow}
            runtime={runtime}
            index={node.index}
            preset={preset}
            categoryId={node.categoryId}
            focusedService={focusedService}
          />
        </group>
      </group>
      <group ref={hitGroupRef}>
        <HitZone
          radius={1}
          nodeKey={node.key}
          path={node.path}
          onNavigate={onNavigate}
          busRef={busRef}
          runtime={runtime}
          index={node.index}
          prewarm={prewarm}
          prewarmKey={systemPrewarmKey(node.categoryId)}
        />
      </group>
    </group>
  );
}
