'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group, type Mesh, type ShaderMaterial } from 'three';
import { useSceneStore } from '@/store/scene';
import type { SceneBusRef } from '../bus';
import { dampFactor } from '../camera/damp';
import { MOTION, SYSTEM_BASE_TILT } from '../config';
import { sceneNodeId } from '../node-ids';
import type { CompileApiRef } from '../prewarm/api';
import { COMPILE_PRIORITY } from '../prewarm/compile-queue';
import type { SystemMaterials } from '../prewarm/system-materials';
import type { QualityPreset } from '../quality';
import { isPerspectiveCamera, pointScale } from '../three-utils';
import { CORE_STYLES } from '../universe/core-styles';
import type { CategoryNodeModel } from '../universe/model';
import type { UniverseRuntimeRef } from '../universe/runtime';
import { pixelsPerUnit } from '../universe/screen-size';
import { CORONA_SCALE, NODE_CORE_RADIUS, SYSTEM_DETAIL_EPSILON, systemDetail } from './constants';
import { CoreExtraMesh } from './CoreExtras';
import { Planet, type SystemRuntime } from './Planet';
import { freeOrbitAngle, planetLocalPosition, planetSpeedTarget } from './planet-math';

export { NODE_CORE_RADIUS, SYSTEM_DETAIL_EPSILON, systemDetail };

/** Planet speed easing (heavy, calm: no snapping to a stop). */
const SPEED_RATE = 2.2;
/** Brightness of a focused planet's siblings. */
const SIBLING_DIM = 0.32;
/** Comet tail length, world units. */
const COMET_TAIL_LENGTH = 1.5;

interface SystemContentProps {
  node: CategoryNodeModel;
  preset: QualityPreset;
  materials: SystemMaterials;
  /** `prewarm`: mounted off-screen only to compile its programs. */
  mode: 'live' | 'prewarm';
  runtime?: UniverseRuntimeRef;
  compile?: CompileApiRef;
  busRef?: SceneBusRef;
  /** Slug of the planet the URL focuses (planet route), else null. */
  focusedService?: string | null;
  onNavigate?: (path: string, replace?: boolean) => void;
  /**
   * Live: true once the content is compiled and can be shown. The universe
   * core hides when this is set and `systemDetail(...)` > 0 for the same frame.
   */
  readyRef?: RefObject<boolean>;
}

/**
 * A category's planetary system (BRIEF scene 2), mounted only while the
 * system is active or being prewarmed and disposed otherwise (B2.2):
 * - the core in its DNA style (one program per style) with its corona and
 *   the style's extra (forge rim, comet tail);
 * - one Planet per service on its DNA orbit. Planets slow down when hovered
 *   (3D or `service:<cat>/<slug>` highlight from the HTML) and park when the
 *   URL focuses them; their live angles and screen positions go to the bus
 *   for the camera (planet framing) and the labels.
 * Everything takes over from the universe core / orbit preview during the
 * dive, as `systemDetail` rises.
 */
export function SystemContent({
  node,
  preset,
  materials,
  mode,
  runtime,
  compile,
  busRef,
  focusedService = null,
  onNavigate,
  readyRef,
}: SystemContentProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const coronaRef = useRef<Mesh>(null);
  const extraRef = useRef<Group>(null);
  const systemRef = useRef<SystemRuntime | null>(null);
  const highlightRef = useRef<string | null>(null);
  const scratch = useRef({
    center: new Vector3(),
    world: new Vector3(),
    rel: new Vector3(),
    forward: new Vector3(),
  });
  const [compiled, setCompiled] = useState(false);
  const style = CORE_STYLES[node.core];
  // Uniform writes go through a ref (the cached materials are shared objects).
  const materialsRef = useRef(materials);
  useEffect(() => {
    materialsRef.current = materials;
  }, [materials]);

  // Live content mounts at the start of a dive: compile through the queue and
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

  useEffect(() => {
    if (mode !== 'live') return;
    highlightRef.current = useSceneStore.getState().highlighted;
    return useSceneStore.subscribe((state) => {
      highlightRef.current = state.highlighted;
    });
  }, [mode]);

  // Leave nothing of this system on the bus once it unmounts.
  useEffect(() => {
    if (mode !== 'live' || !busRef) return;
    const bus = busRef.current;
    const keys = node.orbits.map((orbit) => `${node.categoryId}/${orbit.serviceSlug}`);
    return () => {
      for (const key of keys) {
        bus.planetAngles.delete(key);
        bus.planetTargets.delete(key);
      }
    };
  }, [mode, busRef, node]);

  // Before the planets (priority 0) read the runtime; after the universe runtime (-0.5).
  useFrame((state, delta) => {
    if (mode !== 'live') return;
    const rt = runtime?.current;
    const group = groupRef.current;
    if (!rt || !group) return;
    const dt = Math.min(delta, 0.1);
    const i = node.index;
    const detail = systemDetail(rt.focus[i] ?? 0, rt.corePx[i] ?? 0);
    const visible = compiled && detail > SYSTEM_DETAIL_EPSILON;
    group.visible = visible;
    const emphasis = rt.emphasis[i] ?? 0;
    // Same size and spin as the universe core it replaces (slightly larger: no depth fight).
    const scale =
      ((rt.coreRadius[i] ?? NODE_CORE_RADIUS) / NODE_CORE_RADIUS) * (1 + 0.1 * emphasis);
    const m = materialsRef.current;
    const shared = m.uniforms;
    shared.uTime.value = rt.time;
    const s = scratch.current;
    s.center.set(node.position[0], node.position[1], node.position[2]).add(rt.offsets[i]!);
    shared.uCorePos.value.copy(s.center);

    const core = coreRef.current;
    if (core) {
      core.scale.setScalar(scale * 1.002);
      core.rotation.y = rt.time * 0.12;
      const uniforms = (core.material as ShaderMaterial).uniforms;
      uniforms.uEmphasis.value = emphasis;
      uniforms.uSmall.value = rt.small[i] ?? 0;
      uniforms.uDetail.value = detail;
    }
    const corona = coronaRef.current;
    if (corona) {
      corona.scale.setScalar(scale * CORONA_SCALE);
      const uniforms = (corona.material as ShaderMaterial).uniforms;
      uniforms.uIntensity.value = detail * 0.8;
      uniforms.uCoreRadius.value = NODE_CORE_RADIUS * scale;
    }
    const extra = extraRef.current;
    if (extra && style.extra === 'forge-rim') {
      extra.scale.setScalar(NODE_CORE_RADIUS * scale);
      extra.rotation.set(0.18, rt.time * 0.25, 0.08);
    }
    if (style.extra === 'comet-tail' && m.tail) {
      const tail = m.tail.uniforms;
      tail.uCoreRadius.value = NODE_CORE_RADIUS * scale;
      tail.uLength.value = COMET_TAIL_LENGTH;
      tail.uIntensity.value = detail;
      tail.uScale.value = pointScale(state);
      tail.uPixelRatio.value = state.viewport.dpr;
    }

    // Planets: speed (hover slows, focus parks), angle, hover, materialize.
    const highlight = highlightRef.current;
    const system = (systemRef.current ??= {
      time: rt.time,
      planets: node.orbits.map((orbit) => {
        const isFocused = orbit.serviceSlug === focusedService;
        return {
          angle: isFocused ? orbit.phase : freeOrbitAngle(orbit, rt.time),
          speed: isFocused ? 0 : 1,
          hover: 0,
          fade: 0,
          pxPerUnit: 1,
        };
      }),
    });
    system.time = rt.time;
    const speedK = rt.animated ? dampFactor(SPEED_RATE, dt) : 1;
    const hoverK = dampFactor(MOTION.hoverRate, dt);
    const fade = smoothstep(0.15, 0.85, detail) * (visible ? 1 : 0);
    const cam = state.camera;
    cam.getWorldDirection(s.forward);
    const fov = isPerspectiveCamera(cam) ? cam.fov : 50;
    const { width, height } = state.size;
    const bus = busRef?.current;
    node.orbits.forEach((orbit, index) => {
      const st = system.planets[index]!;
      const id = sceneNodeId.service(node.categoryId, orbit.serviceSlug);
      const hovered = highlight === id;
      const focused = orbit.serviceSlug === focusedService;
      st.speed += (planetSpeedTarget(focused, hovered) - st.speed) * speedK;
      if (rt.animated) st.angle += orbit.speed * st.speed * dt;
      st.hover += ((hovered ? 1 : 0) - st.hover) * hoverK;
      st.fade = fade;
      const planetUniforms = m.planets[index]?.uniforms;
      if (planetUniforms) {
        planetUniforms.uHover.value = st.hover;
        planetUniforms.uFade.value = fade;
        // A focused planet stands out: its siblings recede (they light up again on hover).
        const dimTarget = focusedService && !focused ? Math.max(SIBLING_DIM, st.hover) : 1;
        planetUniforms.uDim.value += (dimTarget - planetUniforms.uDim.value) * speedK;
      }
      // World position → screen (labels, hit-zone size, camera framing).
      const local = planetLocalPosition(orbit, st.angle);
      s.world.set(local[0], local[1], local[2]).add(s.center);
      const depth = s.rel.subVectors(s.world, cam.position).dot(s.forward);
      st.pxPerUnit = pixelsPerUnit(height, fov, depth);
      if (!bus) return;
      const key = `${node.categoryId}/${orbit.serviceSlug}`;
      bus.planetAngles.set(key, st.angle);
      const ndc = s.world.project(cam);
      bus.planetTargets.set(key, {
        x: (ndc.x * 0.5 + 0.5) * width,
        y: (0.5 - ndc.y * 0.5) * height,
        radiusPx: orbit.size * fade * st.pxPerUnit,
        pxPerUnit: st.pxPerUnit,
        inFront: ndc.z < 1,
        visible: fade > 0.5,
        label: orbit.label,
        color: orbit.color,
        ordinal: orbit.ordinal,
        total: node.orbits.length,
      });
    });
  }, -0.25);

  const detail = Math.min(preset.coreDetail, 5);
  const tailParticles = preset.tier === 'high' ? 220 : preset.tier === 'medium' ? 150 : 90;
  return (
    <group ref={groupRef} visible={mode === 'prewarm'}>
      {/* Materials come from the Experience-owned cache: R3F disposes only the geometries. */}
      <mesh ref={coreRef} material={materials.core}>
        <icosahedronGeometry args={[NODE_CORE_RADIUS, detail]} />
      </mesh>
      <mesh ref={coronaRef} material={materials.corona} renderOrder={2}>
        <icosahedronGeometry args={[NODE_CORE_RADIUS, Math.min(detail, 4)]} />
      </mesh>
      {style.extra === 'forge-rim' && materials.rim ? (
        <CoreExtraMesh ref={extraRef} kind="forge-rim" material={materials.rim} particles={0} />
      ) : null}
      {style.extra === 'comet-tail' && materials.tail ? (
        <CoreExtraMesh kind="comet-tail" material={materials.tail} particles={tailParticles} />
      ) : null}
      <group rotation={[SYSTEM_BASE_TILT, 0, 0]}>
        {node.orbits.map((orbit, index) => (
          <Planet
            key={orbit.serviceSlug}
            node={node}
            orbit={orbit}
            index={index}
            materials={materials.planets[index]!}
            preset={preset}
            mode={mode}
            runtime={systemRef}
            busRef={busRef}
            focused={orbit.serviceSlug === focusedService}
            planetMode={focusedService !== null}
            onNavigate={onNavigate}
          />
        ))}
      </group>
    </group>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}
