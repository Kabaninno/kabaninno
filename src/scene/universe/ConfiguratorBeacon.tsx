'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Group,
  type Mesh,
  type ShaderMaterial,
} from 'three';
import type { SceneBusRef } from '../bus';
import { dampFactor } from '../camera/damp';
import { qualityDefines, type QualityPreset } from '../quality';
import { beamFragment, beamVertex, pingFragment, pingVertex } from '../shaders/beacon';
import { nodeCoreFragment, nodeCoreVertex } from '../shaders/node-core';
import { fogUniforms } from '../three-utils';
import { Halo } from './Halo';
import { HitZone } from './HitZone';
import type { ConfiguratorNodeModel } from './model';
import { mixOklch } from '../color-math';
import { neighbourDim, type UniverseRuntimeRef } from './runtime';

/** Beacon core radius (world units); `Universe` enlarges it to its minimum on-screen size. */
export const BEACON_CORE_RADIUS = 0.3;
const CORE_RADIUS = BEACON_CORE_RADIUS;
/** Seconds each palette color dominates before blending into the next. */
const COLOR_PERIOD = 6;
/** Rate at which the beacon's tint follows a selection change. */
const TINT_RATE = 6;

interface ConfiguratorBeaconProps {
  node: ConfiguratorNodeModel;
  /** Read and written (the beacon publishes its live accent for the label). */
  runtimeRef: UniverseRuntimeRef;
  preset: QualityPreset;
  onNavigate: (path: string, replace?: boolean) => void;
  busRef: SceneBusRef;
}

/**
 * The configurator "beacon": faceted core, vertical signal beam and sonar
 * pings. Idle, its tint slowly cycles through the category accents; with a
 * configurator selection (D81) it holds a steady blend of the selected ones.
 */
export function ConfiguratorBeacon({
  node,
  runtimeRef,
  preset,
  onNavigate,
  busRef,
}: ConfiguratorBeaconProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const coreMaterialRef = useRef<ShaderMaterial>(null);
  const beamMaterialRef = useRef<ShaderMaterial>(null);
  const pingMaterialRef = useRef<ShaderMaterial>(null);
  const haloMaterialRef = useRef<ShaderMaterial>(null);

  const palette = useMemo(() => node.palette.map((hex) => new Color(hex)), [node.palette]);
  const white = useMemo(() => new Color('#ffffff'), []);
  const currentColor = useRef(new Color(node.color));
  // Palette indices (= category node indices) blended this frame; reused, no allocation.
  const activeRef = useRef<number[]>([]);

  const coreUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uColor: { value: new Color(node.color) },
      uGlow: { value: new Color(node.glow) },
      uTime: { value: 0 },
      uEmphasis: { value: 0 },
      uSeed: { value: 11.3 },
      uSmall: { value: 0 },
      uPresence: { value: 1 },
    }),
    [node.color, node.glow],
  );
  const beamUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uColor: { value: new Color(node.color) },
      uTime: { value: 0 },
      uEmphasis: { value: 0 },
      uIntensity: { value: 0.7 },
      uWidth: { value: 0.5 },
      uHeight: { value: 4.8 },
    }),
    [node.color],
  );
  const pingUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uColor: { value: new Color(node.color) },
      uTime: { value: 0 },
      uEmphasis: { value: 0 },
      uPing: { value: 1 },
      uIntensity: { value: 1 },
    }),
    [node.color],
  );

  useFrame((_, delta) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const group = groupRef.current;
    if (group) {
      const offset = rt.offsets[node.index];
      group.position.set(node.position[0], node.position[1], node.position[2]);
      if (offset) group.position.add(offset);
    }
    const emphasis = rt.emphasis[node.index] ?? 0;
    const time = rt.time;

    // Blend through the palette with long, eased crossfades — in OKLCH, so
    // complementary accents never pass through a dull grey (visual V2-07).
    // With a configurator selection only the selected categories take part.
    const active = activeRef.current;
    active.length = 0;
    for (let i = 0; i < palette.length; i++) {
      if ((rt.selected[i] ?? 0) > 0.5) active.push(i);
    }
    const current = currentColor.current;
    let target: [number, number, number] | null = null;
    if (active.length > 0) {
      // A selection holds one steady blend of its colours (visual MN-3): equal
      // weights, mixed in OKLCH one colour at a time.
      const first = palette[active[0]!]!;
      target = [first.r, first.g, first.b];
      for (let k = 1; k < active.length; k++) {
        const next = palette[active[k]!]!;
        target = mixOklch(target, [next.r, next.g, next.b], 1 / (k + 1));
      }
    } else {
      // Idle: slowly cycle through every category accent.
      const cycle = time / COLOR_PERIOD;
      const from = palette[Math.floor(cycle) % palette.length];
      const to = palette[(Math.floor(cycle) + 1) % palette.length];
      const blend = smoothstep(0.55, 1, cycle - Math.floor(cycle));
      if (from && to) target = mixOklch([from.r, from.g, from.b], [to.r, to.g, to.b], blend);
    }
    if (target) {
      const [r, g, b] = target;
      // Ease toward the palette colour so a selection change never pops.
      const k = rt.animated ? dampFactor(TINT_RATE, Math.min(delta, 0.1)) : 1;
      const [cr, cg, cb] = mixOklch([current.r, current.g, current.b], [r, g, b], k);
      current.setRGB(cr, cg, cb);
    }
    rt.liveAccent[node.index] = `#${current.getHexString()}`;

    if (coreRef.current) {
      const grow =
        ((rt.coreRadius[node.index] ?? CORE_RADIUS) / CORE_RADIUS) * (1 + 0.15 * emphasis);
      coreRef.current.rotation.set(0, time * 0.33, 0);
      coreRef.current.scale.set(grow, grow * 1.6, grow);
    }
    for (const ref of [coreMaterialRef, beamMaterialRef, pingMaterialRef, haloMaterialRef]) {
      const material = ref.current;
      if (!material) continue;
      const color = material.uniforms.uColor.value as Color;
      color.copy(current);
      if (ref === haloMaterialRef || ref === coreMaterialRef) {
        (material.uniforms.uGlow.value as Color)
          .copy(color)
          .lerp(white, ref === haloMaterialRef ? 0.5 : 0.3);
      }
      if (material.uniforms.uTime) material.uniforms.uTime.value = time;
      material.uniforms.uEmphasis.value = emphasis;
      if (material.uniforms.uSmall) material.uniforms.uSmall.value = rt.small[node.index] ?? 0;
    }
    if (pingMaterialRef.current) pingMaterialRef.current.uniforms.uPing.value = rt.animated ? 1 : 0;
    const presence = rt.presence[node.index] ?? 1;
    const dim = neighbourDim(rt, node.index) * presence;
    if (coreMaterialRef.current) coreMaterialRef.current.uniforms.uPresence.value = presence;
    if (coreRef.current) coreRef.current.visible = presence > 0.02;
    if (beamMaterialRef.current) beamMaterialRef.current.uniforms.uIntensity.value = 0.7 * dim;
    if (pingMaterialRef.current) pingMaterialRef.current.uniforms.uIntensity.value = dim;
  });

  const defines = qualityDefines(preset);
  const variant = preset.lowQualityShaders ? 'low' : 'full';

  return (
    <group ref={groupRef} position={node.position}>
      <mesh ref={coreRef} scale={[1, 1.6, 1]}>
        <icosahedronGeometry args={[CORE_RADIUS, 0]} />
        <shaderMaterial
          key={variant}
          ref={coreMaterialRef}
          uniforms={coreUniforms}
          vertexShader={nodeCoreVertex}
          fragmentShader={nodeCoreFragment}
          defines={defines}
        />
      </mesh>
      <mesh frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          key={variant}
          ref={beamMaterialRef}
          uniforms={beamUniforms}
          vertexShader={beamVertex}
          fragmentShader={beamFragment}
          defines={defines}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[5.4, 5.4]} />
        <shaderMaterial
          key={variant}
          ref={pingMaterialRef}
          uniforms={pingUniforms}
          vertexShader={pingVertex}
          fragmentShader={pingFragment}
          defines={defines}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
      <Halo
        color={node.color}
        glow={node.glow}
        size={1.9}
        lift={CORE_RADIUS * 1.7}
        intensity={0.85}
        runtime={runtimeRef}
        index={node.index}
        preset={preset}
        materialRef={haloMaterialRef}
      />
      <HitZone
        radius={2.3}
        nodeKey={node.key}
        path={node.path}
        onNavigate={onNavigate}
        busRef={busRef}
        runtime={runtimeRef}
        index={node.index}
      />
    </group>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}
