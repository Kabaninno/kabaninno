'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useSceneStore } from '@/store/scene';
import { keepAlive, type SceneBusRef } from '../bus';
import { MOTION } from '../config';
import { dampFactor } from '../camera/damp';
import { isSceneDebugEnabled } from '../debug/scene-stats';
import { sceneNodeId, universeKeyForHighlight } from '../node-ids';
import {
  ARCHIVE_PREWARM_KEY,
  systemPrewarmKey,
  type CompileApiRef,
  type PrewarmApiRef,
} from '../prewarm/api';
import type { ArchiveMaterialCache } from '../portfolio/archive-materials';
import type { SystemMaterialCache } from '../prewarm/system-materials';
import type { QualityPreset } from '../quality';
import { NODE_CORE_RADIUS } from '../system/SystemContent';
import { isPerspectiveCamera, motionTime } from '../three-utils';
import { CategoryNode } from './CategoryNode';
import { BEACON_CORE_RADIUS, ConfiguratorBeacon } from './ConfiguratorBeacon';
import type { UniverseModel, UniverseNode } from './model';
import { Network } from './Network';
import { NodeLabels } from './NodeLabels';
import { PortfolioCluster } from './PortfolioCluster';
import {
  DRIFT_AMPLITUDE,
  FOCUSED_NETWORK,
  LINK_GROW_SECONDS,
  SELECTED_EMPHASIS,
  createUniverseRuntime,
  easeSelection,
  staggerSelection,
  stepSelection,
  writeDrift,
  type UniverseRuntime,
} from './runtime';
import { SelectionLinks } from './SelectionLinks';
import {
  MIN_CORE_SHARE,
  coreWorldRadius,
  nodeVisualRadiusPx,
  orbitClearanceScale,
  pixelsPerUnit,
  presenceInFrame,
  smallCoreBoost,
} from './screen-size';

/** True world radius of each node kind's core (portfolio: the cluster's bright core). */
const BASE_RADIUS: Record<UniverseNode['kind'], number> = {
  category: NODE_CORE_RADIUS,
  configurator: BEACON_CORE_RADIUS,
  portfolio: 1.1,
};
const PRESENCE_RATE = 6;

interface UniverseProps {
  model: UniverseModel;
  /** Universe node the URL focuses (null = overview). */
  focusKey: string | null;
  /** Planet the URL focuses ("<category>/<slug>" route), else null. */
  focusedPlanet: { category: string; service: string } | null;
  /** Project the URL focuses (case route), else null. */
  focusedProject: string | null;
  preset: QualityPreset;
  reducedMotion: boolean;
  onNavigate: (path: string, replace?: boolean) => void;
  busRef: SceneBusRef;
  prewarm: PrewarmApiRef;
  compile: CompileApiRef;
  systemMaterials: SystemMaterialCache;
  archiveMaterials: ArchiveMaterialCache;
}

/**
 * The universe: the neural network (minor nodes, links), the category nodes,
 * the portfolio cluster, the configurator beacon and the hover labels. Owns
 * the per-frame runtime every child reads — drift, eased hover, focus (in
 * lockstep with camera flights through the bus), minimum on-screen core
 * sizes and the network fade — so hover and highlight never re-render React.
 */
export function Universe({
  model,
  focusKey,
  focusedPlanet,
  focusedProject,
  preset,
  reducedMotion,
  onNavigate,
  busRef,
  prewarm,
  compile,
  systemMaterials,
  archiveMaterials,
}: UniverseProps) {
  const runtime = useRef<UniverseRuntime | null>(null);
  // Highlight id from the shared store (3D hover or HTML nav focus), kept in a ref.
  const highlightRef = useRef<string | null>(null);
  // Configurator selection (store `emphasis`, D81) as universe node keys.
  const emphasisRef = useRef<ReadonlySet<string>>(new Set());
  const scratch = useRef({
    world: new Vector3(),
    forward: new Vector3(),
    rel: new Vector3(),
    ndc: new Vector3(),
  });

  useEffect(() => {
    const apply = (id: string | null) => {
      const key = universeKeyForHighlight(id);
      highlightRef.current = key;
      keepAlive(busRef.current, 600);
      // Desktop hover / keyboard focus on an HTML link warms that system up.
      const node = key ? model.byKey.get(key) : undefined;
      if (node?.kind === 'category') prewarm.current?.prioritize(systemPrewarmKey(node.categoryId));
      if (node?.kind === 'portfolio') prewarm.current?.prioritize(ARCHIVE_PREWARM_KEY);
    };
    apply(useSceneStore.getState().highlighted);
    return useSceneStore.subscribe((state, previous) => {
      if (state.highlighted !== previous.highlighted) apply(state.highlighted);
    });
  }, [busRef, model, prewarm]);

  // `?debug=1`: node projections for reviewers (how much of the free area the network fills).
  useEffect(() => {
    if (!isSceneDebugEnabled(window.location.search)) return;
    window.__sceneNodes = () =>
      model.nodes.map((node) => {
        const i = node.index;
        const rt = runtime.current;
        const corePx = rt?.corePx[i] ?? 0;
        const ppu = rt?.pxPerUnit[i] ?? 0;
        let visualPx = nodeVisualRadiusPx(
          node.kind,
          corePx,
          ppu,
          node.kind === 'category' ? node.systemRadius : 0,
        );
        if (node.kind === 'category') {
          // What is really drawn: the outer orbit of the preview, widened to clear the core.
          const inner = Math.min(...node.orbits.map((orbit) => orbit.radius));
          const outer = Math.max(...node.orbits.map((orbit) => orbit.radius));
          const orbitScale = orbitClearanceScale(rt?.coreRadius[i] ?? 0, inner);
          visualPx = Math.max(visualPx, outer * orbitScale * ppu);
        }
        return {
          key: node.key,
          x: rt?.screenX[i] ?? 0,
          y: rt?.screenY[i] ?? 0,
          corePx,
          visualPx,
          presence: rt?.presence[i] ?? 0,
        };
      });
    return () => {
      delete window.__sceneNodes;
    };
  }, [model]);

  useEffect(() => {
    const apply = (ids: readonly string[]) => {
      const keys = new Set<string>();
      for (const id of ids) {
        const key = universeKeyForHighlight(id);
        if (key) keys.add(key);
      }
      emphasisRef.current = keys;
      keepAlive(busRef.current, 600);
    };
    apply(useSceneStore.getState().emphasis);
    return useSceneStore.subscribe((state, previous) => {
      if (state.emphasis !== previous.emphasis) apply(state.emphasis);
    });
  }, [busRef]);

  // After CameraControls moved the camera (-1), before the node components (0).
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const time = motionTime(state, reducedMotion);
    const hoverK = dampFactor(MOTION.hoverRate, dt);
    const focusK = reducedMotion ? 1 : dampFactor(MOTION.focusRate, dt);
    const highlighted = highlightRef.current;
    // The selection only shows on the configurator view (D81); elsewhere it eases out.
    const selection = focusKey === sceneNodeId.configurator ? emphasisRef.current : null;
    const rt = (runtime.current ??= createUniverseRuntime());
    const shared = busRef.current;
    const cam = state.camera;
    const { world, forward, rel, ndc } = scratch.current;
    cam.updateMatrixWorld();
    cam.getWorldDirection(forward);
    const fov = isPerspectiveCamera(cam) ? cam.fov : 50;
    const { width: viewportWidth, height: viewportHeight, left, top } = state.size;
    const presenceK = reducedMotion ? 1 : dampFactor(PRESENCE_RATE, dt);
    // Free frame in canvas px (the whole canvas when the UI publishes none).
    const rect = useSceneStore.getState().safeRect;
    const frameLeft = rect ? rect.x - left : 0;
    const frameTop = rect ? rect.y - top : 0;
    const frameRight = rect ? frameLeft + rect.width : viewportWidth;
    const frameBottom = rect ? frameTop + rect.height : viewportHeight;

    rt.time = time;
    rt.animated = !reducedMotion;
    rt.stagger.clock += dt;
    shared.hovering = highlighted !== null;
    let maxFocus = 0;
    let settling = false;
    for (const node of model.nodes) {
      const i = node.index;
      const hoverTarget = node.key === highlighted ? 1 : 0;
      const hover = rt.hover[i]! + (hoverTarget - rt.hover[i]!) * hoverK;
      let focus: number;
      if (shared.focusDriven) {
        focus = Math.min(
          (node.key === shared.focusFrom ? shared.focusFromAmount : 0) +
            (node.key === shared.focusTo ? shared.focusToAmount : 0),
          1,
        );
      } else {
        const focusTarget = node.key === focusKey ? 1 : 0;
        focus = rt.focus[i]! + (focusTarget - rt.focus[i]!) * focusK;
        if (Math.abs(focusTarget - focus) > 0.002) settling = true;
      }
      if (Math.abs(hoverTarget - hover) > 0.002) settling = true;
      // Selections that start together light up (and grow their links) one after another.
      const wanted = node.kind !== 'configurator' && selection?.has(node.key) ? 1 : 0;
      // (A link still withdrawing counts as under way: re-selecting it never waits.)
      const selectTarget = staggerSelection(
        wanted,
        Math.max(rt.selectProgress[i]!, rt.linkProgress[i]!),
        rt.stagger,
        reducedMotion,
      );
      // A started selection leaves 0 this frame even on a zero-length frame (its slot is taken).
      const selectDt = Math.max(dt, 1e-4);
      const progress = stepSelection(rt.selectProgress[i]!, selectTarget, selectDt, reducedMotion);
      const linkProgress = stepSelection(
        rt.linkProgress[i]!,
        selectTarget,
        selectDt,
        reducedMotion,
        LINK_GROW_SECONDS,
      );
      if (progress !== wanted || linkProgress !== wanted) settling = true;
      rt.selectProgress[i] = progress;
      rt.selected[i] = easeSelection(progress);
      rt.linkProgress[i] = linkProgress;
      rt.link[i] = easeSelection(linkProgress);
      rt.hover[i] = hover;
      rt.focus[i] = focus;
      // Hover / highlight stays on top of the steady selected state.
      rt.emphasis[i] = Math.max(hover, focus * 0.45, rt.selected[i]! * SELECTED_EMPHASIS);
      maxFocus = Math.max(maxFocus, focus);
      writeDrift(rt.offsets[i]!, i, time, DRIFT_AMPLITUDE * (1 - focus));

      // Minimum on-screen core size for the current framing (N-07, M3-04).
      world.set(node.position[0], node.position[1], node.position[2]).add(rt.offsets[i]!);
      const depth = rel.subVectors(world, cam.position).dot(forward);
      const ppu = pixelsPerUnit(viewportHeight, fov, depth);
      const base = BASE_RADIUS[node.kind] * (1 + 0.1 * focus);
      const radius = coreWorldRadius(base, shared.minCorePx * MIN_CORE_SHARE[node.kind], ppu);
      rt.pxPerUnit[i] = ppu;
      rt.coreRadius[i] = radius;
      rt.corePx[i] = radius * 2 * ppu;
      rt.small[i] = smallCoreBoost(rt.corePx[i]!);

      // Presence: fade nodes the overlays would cover (never the camera's focus).
      ndc.copy(world).project(cam);
      const sx = (ndc.x * 0.5 + 0.5) * viewportWidth;
      const sy = (0.5 - ndc.y * 0.5) * viewportHeight;
      const inFront = ndc.z < 1;
      rt.screenX[i] = sx;
      rt.screenY[i] = sy;
      rt.inFront[i] = inFront;
      const focusTarget =
        node.key === focusKey ||
        node.key === shared.presenceKey ||
        (shared.focusDriven && node.key === shared.focusTo);
      // What the node visibly occupies, not just its centre: it never shows clipped
      // by the free frame's edge (HUD, panel, sheet) — it fades once that crosses it.
      const visual = nodeVisualRadiusPx(
        node.kind,
        rt.corePx[i] ?? 0,
        ppu,
        node.kind === 'category' ? node.systemRadius : 0,
      );
      const presenceTarget =
        focusTarget || !inFront
          ? 1
          : presenceInFrame(sx, sy, visual, {
              left: frameLeft,
              top: frameTop,
              right: frameRight,
              bottom: frameBottom,
            });
      const presence = rt.presence[i]! + (presenceTarget - rt.presence[i]!) * presenceK;
      rt.presence[i] = presence;
      if (Math.abs(presenceTarget - presence) > 0.002) settling = true;
    }

    if (shared.focusDriven) {
      rt.network = 1 - (1 - FOCUSED_NETWORK) * maxFocus;
    } else {
      const networkTarget = focusKey ? FOCUSED_NETWORK : 1;
      rt.network += (networkTarget - rt.network) * focusK;
      if (Math.abs(networkTarget - rt.network) > 0.002) settling = true;
    }
    // frameloop="demand" (reduced motion): keep drawing until the easing settles.
    if (settling) keepAlive(shared, 100);
  }, -0.5);

  return (
    <group>
      <Network model={model} runtime={runtime} preset={preset} busRef={busRef} />
      <SelectionLinks model={model} runtime={runtime} preset={preset} />
      {model.categories.map((node) => (
        <CategoryNode
          key={node.key}
          node={node}
          runtime={runtime}
          preset={preset}
          focused={node.key === focusKey}
          focusedService={
            focusedPlanet?.category === node.categoryId ? focusedPlanet.service : null
          }
          onNavigate={onNavigate}
          busRef={busRef}
          prewarm={prewarm}
          compile={compile}
          systemMaterials={systemMaterials}
        />
      ))}
      <PortfolioCluster
        node={model.portfolio}
        runtime={runtime}
        preset={preset}
        focused={focusKey === model.portfolio.key}
        focusedProject={focusedProject}
        onNavigate={onNavigate}
        busRef={busRef}
        prewarm={prewarm}
        compile={compile}
        archiveMaterials={archiveMaterials}
      />
      <ConfiguratorBeacon
        node={model.configurator}
        runtimeRef={runtime}
        preset={preset}
        onNavigate={onNavigate}
        busRef={busRef}
      />
      <NodeLabels model={model} runtime={runtime} busRef={busRef} reducedMotion={reducedMotion} />
    </group>
  );
}
