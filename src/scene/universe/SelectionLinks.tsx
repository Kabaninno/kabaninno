'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  Vector3,
  type LineSegments,
  type Points,
  type ShaderMaterial,
} from 'three';
import { MAX_UNIVERSE_NODES } from '../config';
import { qualityDefines, type QualityPreset } from '../quality';
import {
  selectionLinksFragment,
  selectionLinksVertex,
  selectionPulsesFragment,
  selectionPulsesVertex,
} from '../shaders/selection';
import { fogUniforms, pointScale } from '../three-utils';
import type { UniverseModel } from './model';
import type { UniverseRuntimeRef } from './runtime';
import { buildSelectionGeometry } from './selection-model';

/** Impulse sprite size, world units. */
const PULSE_SIZE = 0.5;

interface SelectionLinksProps {
  model: UniverseModel;
  runtime: UniverseRuntimeRef;
  preset: QualityPreset;
}

/**
 * Configurator selection (D81): lit links from each selected category to the
 * beacon, with data impulses travelling into it. Two draw calls, skipped
 * entirely while nothing is selected. Uniform arrays are bound to the runtime
 * by reference (like the network), so drift, the eased selected state, hover
 * and presence need no per-frame copies.
 */
export function SelectionLinks({ model, runtime, preset }: SelectionLinksProps) {
  const linesRef = useRef<LineSegments>(null);
  const pointsRef = useRef<Points>(null);
  const linesMaterialRef = useRef<ShaderMaterial>(null);
  const pointsMaterialRef = useRef<ShaderMaterial>(null);
  const accentRef = useRef<string | null>(null);
  const geometry = useMemo(
    () => buildSelectionGeometry(model, preset.linkSegments),
    [model, preset.linkSegments],
  );

  // Shared by both programs (one object, so one per-frame update).
  const uniforms = useMemo(() => {
    const shared = {
      // Replaced by the runtime arrays (bound by reference) on the first frame.
      uOffsets: { value: Array.from({ length: MAX_UNIVERSE_NODES }, () => new Vector3()) },
      uSelected: { value: new Array<number>(MAX_UNIVERSE_NODES).fill(0) },
      uHover: { value: new Array<number>(MAX_UNIVERSE_NODES).fill(0) },
      uPresence: { value: new Array<number>(MAX_UNIVERSE_NODES).fill(1) },
      uBeacon: { value: model.configurator.index },
      uTime: { value: 0 },
      uPulses: { value: 1 },
      uBeaconColor: { value: new Color(model.configurator.color) },
    };
    return {
      lines: { ...fogUniforms(), ...shared },
      pulses: {
        ...fogUniforms(),
        ...shared,
        uScale: { value: 1 },
        uPixelRatio: { value: 1 },
        uSize: { value: PULSE_SIZE },
      },
    };
  }, [model.configurator.index, model.configurator.color]);

  useFrame((state) => {
    const rt = runtime.current;
    if (!rt) return;
    let any = false;
    for (const node of model.categories) {
      if ((rt.selected[node.index] ?? 0) > 0.001) {
        any = true;
        break;
      }
    }
    if (linesRef.current) linesRef.current.visible = any;
    if (pointsRef.current) pointsRef.current.visible = any && rt.animated;
    if (!any) return;

    // Uniform objects are shared by both programs: one write updates both.
    const material = linesMaterialRef.current ?? pointsMaterialRef.current;
    if (!material) return;
    const u = material.uniforms;
    u.uOffsets.value = rt.offsets;
    u.uSelected.value = rt.selected;
    u.uHover.value = rt.hover;
    u.uPresence.value = rt.presence;
    u.uTime.value = rt.time;
    u.uPulses.value = rt.animated ? 1 : 0;
    const accent = rt.liveAccent[model.configurator.index] ?? null;
    if (accent && accent !== accentRef.current) {
      accentRef.current = accent;
      (u.uBeaconColor.value as Color).set(accent);
    }
    const sprites = pointsMaterialRef.current;
    if (sprites) {
      sprites.uniforms.uScale.value = pointScale(state);
      sprites.uniforms.uPixelRatio.value = state.viewport.dpr;
    }
  });

  const variant = preset.lowQualityShaders ? 'low' : 'full';
  const defines = { ...qualityDefines(preset), MAX_NODES: String(MAX_UNIVERSE_NODES) };
  const { lines, pulses } = geometry;

  return (
    <>
      {lines.count > 0 ? (
        <lineSegments ref={linesRef} frustumCulled={false} renderOrder={1} visible={false}>
          <bufferGeometry key={`selection-${lines.count}`}>
            <bufferAttribute attach="attributes-position" args={[lines.positions, 3]} />
            <bufferAttribute attach="attributes-aT" args={[lines.t, 1]} />
            <bufferAttribute attach="attributes-aCat" args={[lines.cat, 1]} />
            <bufferAttribute attach="attributes-aSeed" args={[lines.seed, 1]} />
            <bufferAttribute attach="attributes-aFlow" args={[lines.flow, 2]} />
            <bufferAttribute attach="attributes-aColor" args={[lines.color, 3]} />
          </bufferGeometry>
          <shaderMaterial
            key={variant}
            ref={linesMaterialRef}
            uniforms={uniforms.lines}
            vertexShader={selectionLinksVertex}
            fragmentShader={selectionLinksFragment}
            defines={defines}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </lineSegments>
      ) : null}
      {pulses.count > 0 ? (
        <points ref={pointsRef} frustumCulled={false} renderOrder={1} visible={false}>
          <bufferGeometry key={`selection-pulses-${pulses.count}`}>
            <bufferAttribute attach="attributes-position" args={[pulses.positions, 3]} />
            <bufferAttribute attach="attributes-aStart" args={[pulses.start, 3]} />
            <bufferAttribute attach="attributes-aControl" args={[pulses.control, 3]} />
            <bufferAttribute attach="attributes-aCat" args={[pulses.cat, 1]} />
            <bufferAttribute attach="attributes-aSeed" args={[pulses.seed, 1]} />
            <bufferAttribute attach="attributes-aSlot" args={[pulses.slot, 2]} />
            <bufferAttribute attach="attributes-aColor" args={[pulses.color, 3]} />
          </bufferGeometry>
          <shaderMaterial
            key={variant}
            ref={pointsMaterialRef}
            uniforms={uniforms.pulses}
            vertexShader={selectionPulsesVertex}
            fragmentShader={selectionPulsesFragment}
            defines={defines}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      ) : null}
    </>
  );
}
