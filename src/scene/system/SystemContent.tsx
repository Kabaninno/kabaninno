'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, ShaderMaterial } from 'three';
import type { CompileApiRef } from '../prewarm/api';
import { COMPILE_PRIORITY } from '../prewarm/compile-queue';
import type { SystemMaterials } from '../prewarm/system-materials';
import type { QualityPreset } from '../quality';
import type { CategoryNodeModel } from '../universe/model';
import type { UniverseRuntimeRef } from '../universe/runtime';
import { CORONA_SCALE, NODE_CORE_RADIUS } from './constants';

export { NODE_CORE_RADIUS };

interface SystemContentProps {
  node: CategoryNodeModel;
  preset: QualityPreset;
  materials: SystemMaterials;
  /** `prewarm`: mounted off-screen only to compile its programs. */
  mode: 'live' | 'prewarm';
  runtime?: UniverseRuntimeRef;
  compile?: CompileApiRef;
  /**
   * Live: true once the content is compiled and can be shown. The universe
   * core hides when this is set and `systemDetail(...)` > 0 for the same frame.
   */
  readyRef?: RefObject<boolean>;
}

/**
 * The content of a category's planetary system, mounted only while the
 * system is active (or being prewarmed) and disposed otherwise (B2.2).
 * M2: the detailed DNA-styled core and its corona, which take over from the
 * universe core during the dive. M3 adds the planets here, so they are
 * prewarmed through the same registry entry.
 */
export function SystemContent({
  node,
  preset,
  materials,
  mode,
  runtime,
  compile,
  readyRef,
}: SystemContentProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const coronaRef = useRef<Mesh>(null);
  const [compiled, setCompiled] = useState(false);

  // Live content mounts at the start of a dive: compile asynchronously and
  // show it only when ready, so a cold system never stalls a frame.
  useEffect(() => {
    if (mode !== 'live') return;
    const group = groupRef.current;
    if (!group) return;
    let cancelled = false;
    const ticket = compile?.current?.compile(group, COMPILE_PRIORITY.live);
    void (ticket ? ticket.promise : Promise.resolve(true)).then(() => {
      if (!cancelled) setCompiled(true);
    });
    return () => {
      cancelled = true;
      ticket?.cancel();
    };
  }, [mode, compile, materials]);

  useEffect(() => {
    if (readyRef) readyRef.current = compiled;
    return () => {
      if (readyRef) readyRef.current = false;
    };
  }, [readyRef, compiled]);

  useFrame(() => {
    if (mode !== 'live') return;
    const rt = runtime?.current;
    const group = groupRef.current;
    if (!rt || !group) return;
    const i = node.index;
    const detail = systemDetail(rt.focus[i] ?? 0, rt.corePx[i] ?? 0);
    const visible = compiled && detail > SYSTEM_DETAIL_EPSILON;
    group.visible = visible;
    if (!visible) return;
    const emphasis = rt.emphasis[i] ?? 0;
    // Same size and spin as the universe core it replaces (slightly larger: no depth fight).
    const scale =
      ((rt.coreRadius[i] ?? NODE_CORE_RADIUS) / NODE_CORE_RADIUS) * (1 + 0.1 * emphasis);
    const core = coreRef.current;
    if (core) {
      core.scale.setScalar(scale * 1.002);
      core.rotation.y = rt.time * 0.12;
    }
    const corona = coronaRef.current;
    corona?.scale.setScalar(scale * CORONA_SCALE);
    // Uniforms are written through the mesh refs (the cached materials are shared).
    if (core) {
      const uniforms = (core.material as ShaderMaterial).uniforms;
      uniforms.uTime.value = rt.time;
      uniforms.uEmphasis.value = emphasis;
      uniforms.uSmall.value = rt.small[i] ?? 0;
      uniforms.uDetail.value = detail;
    }
    if (corona) {
      const uniforms = (corona.material as ShaderMaterial).uniforms;
      uniforms.uTime.value = rt.time;
      uniforms.uIntensity.value = detail * 0.8;
      uniforms.uCoreRadius.value = NODE_CORE_RADIUS * scale;
    }
  });

  const detail = Math.min(preset.coreDetail, 5);
  return (
    <group ref={groupRef} visible={false}>
      {/* Materials come from the Experience-owned cache: R3F disposes only the geometries. */}
      <mesh ref={coreRef} material={materials.core}>
        <icosahedronGeometry args={[NODE_CORE_RADIUS, detail]} />
      </mesh>
      <mesh ref={coronaRef} material={materials.corona} renderOrder={2}>
        <icosahedronGeometry args={[NODE_CORE_RADIUS, Math.min(detail, 4)]} />
      </mesh>
    </group>
  );
}

/** Below this the universe core shows instead of the system core. */
export const SYSTEM_DETAIL_EPSILON = 0.001;

/** How much of the system-view detail shows: focused and large enough on screen. */
export function systemDetail(focus: number, coreDiameterPx: number): number {
  const t = Math.min(Math.max((coreDiameterPx - 20) / 36, 0), 1);
  return focus * t * t * (3 - 2 * t);
}
