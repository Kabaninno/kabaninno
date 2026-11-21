'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3, type BufferGeometry, type Group } from 'three';
import { useSceneStore } from '@/store/scene';
import { ARCHIVE_READY_KEY, keepAlive, type SceneBusRef } from '../bus';
import { dampFactor } from '../camera/damp';
import { MOTION } from '../config';
import type { CompileApiRef } from '../prewarm/api';
import { COMPILE_PRIORITY } from '../prewarm/compile-queue';
import type { QualityPreset } from '../quality';
import { isPerspectiveCamera } from '../three-utils';
import type { PortfolioNodeModel } from '../universe/model';
import type { UniverseRuntimeRef } from '../universe/runtime';
import { pixelsPerUnit } from '../universe/screen-size';
import { createCardGeometry, createObservatoryRings, observatoryRadii } from './archive-geometry';
import { ARCHIVE, ARCHIVE_FACING, archiveCenterOffset, archiveExtents } from './archive-layout';
import type { ArchiveMaterials } from './archive-materials';
import { ArchiveCard, type ArchiveRuntime } from './ArchiveCard';
import { archiveCardTargets } from './archive-state';
import { emblemFor, type EmblemKey } from './emblems';

interface ArchiveContentProps {
  node: PortfolioNodeModel;
  preset: QualityPreset;
  materials: ArchiveMaterials;
  /** `prewarm`: mounted off-screen only to compile its programs. */
  mode: 'live' | 'prewarm';
  runtime?: UniverseRuntimeRef;
  compile?: CompileApiRef;
  busRef?: SceneBusRef;
  /** Slug of the project the URL focuses (project route), else null. */
  focusedProject?: string | null;
  /** The URL is on the portfolio or a project: the category filter (D87) applies. */
  active?: boolean;
  onNavigate?: (path: string, replace?: boolean) => void;
  /**
   * Compile priority of the live content: `boot` while it is the URL's focus
   * (V5-01: ready by the end of the flight), `live` while only fading.
   */
  priority?: number;
}

/** Ease of the filter / focus dimming: ~300 ms ease-out (instant under reduced motion). */
const DIM_RATE = 10;

/**
 * The portfolio archive ("observatory"), mounted only while the portfolio is
 * focused or being prewarmed: one card-object per project on a curved wall in
 * front of the cluster, inside three slow observatory rings. With no
 * projects only the rings show around the dormant cluster (the label says
 * "coming soon"). Hover (3D or `project:<slug>` from the HTML cards) lights
 * a card; the focused project's siblings and the cards outside the category
 * filter (store `emphasis`, D87) recede. Card screen positions go to the bus
 * for the labels.
 */
export function ArchiveContent({
  node,
  preset,
  materials,
  mode,
  runtime,
  compile,
  busRef,
  focusedProject = null,
  active = false,
  onNavigate,
  priority = COMPILE_PRIORITY.live,
}: ArchiveContentProps) {
  const groupRef = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const [compiled, setCompiled] = useState(false);
  // Read once when the compile starts (a later change must not restart it).
  const priorityRef = useRef(priority);
  const materialsRef = useRef(materials);
  useEffect(() => {
    materialsRef.current = materials;
  }, [materials]);
  const highlightRef = useRef<string | null>(null);
  const emphasisRef = useRef<ReadonlySet<string>>(new Set());
  const stateRef = useRef<ArchiveRuntime | null>(null);
  const scratch = useRef({
    world: new Vector3(),
    rel: new Vector3(),
    forward: new Vector3(),
    toCard: new Vector3(),
  });

  const detail = preset.lowQualityShaders ? 0 : preset.tier === 'high' ? 2 : 1;
  const card = useMemo(() => createCardGeometry(detail), [detail]);
  const emblemGeometries = useMemo(() => {
    const map = new Map<EmblemKey | null, BufferGeometry>();
    for (const project of node.projects) {
      if (!map.has(project.emblem))
        map.set(project.emblem, emblemFor(project.emblem).create(detail));
    }
    return map;
  }, [node.projects, detail]);
  const count = node.projects.length;
  const rings = useMemo(() => {
    const { halfWidth, halfHeight } = archiveExtents(count);
    return createObservatoryRings(observatoryRadii(halfWidth, halfHeight));
  }, [count]);
  useEffect(() => () => card.slab.dispose(), [card]);
  useEffect(() => () => card.edges.dispose(), [card]);
  useEffect(
    () => () => emblemGeometries.forEach((geometry) => geometry.dispose()),
    [emblemGeometries],
  );
  useEffect(() => () => rings.dispose(), [rings]);
  const ringsQuaternion = useMemo(
    () => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...ARCHIVE_FACING)),
    [],
  );
  const center = useMemo(() => archiveCenterOffset(), []);

  // Live content mounts at the start of the flight: compile through the queue
  // and show it only when ready, so a cold archive never stalls a frame.
  useEffect(() => {
    if (mode !== 'live') return;
    const group = groupRef.current;
    if (!group) return;
    let cancelled = false;
    const ticket = compile?.current?.compile(group, priorityRef.current);
    void (ticket ? ticket.promise : Promise.resolve(true)).then(() => {
      if (cancelled) return;
      setCompiled(true);
      // frameloop="demand" (reduced motion): draw the frames that show it.
      if (busRef) keepAlive(busRef.current, 800);
      invalidate();
    });
    return () => {
      cancelled = true;
      ticket?.cancel();
    };
  }, [mode, compile, materials, busRef, invalidate]);

  useEffect(() => {
    if (mode !== 'live') return;
    const apply = () => {
      const state = useSceneStore.getState();
      highlightRef.current = state.highlighted;
      emphasisRef.current = new Set(state.emphasis.filter((id) => id.startsWith('project:')));
    };
    apply();
    return useSceneStore.subscribe((state, previous) => {
      if (state.highlighted !== previous.highlighted || state.emphasis !== previous.emphasis) {
        apply();
      }
    });
  }, [mode]);

  useEffect(() => {
    if (mode !== 'live' || !busRef) return;
    const bus = busRef.current;
    return () => {
      bus.projectTargets.clear();
      bus.readyContent.delete(ARCHIVE_READY_KEY);
    };
  }, [mode, busRef]);

  // After the universe runtime (-0.5), before the cards (0).
  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const archive = (stateRef.current ??= {
      time: 0,
      animated: true,
      cards: node.projects.map(() => ({
        hover: 0,
        dim: 1,
        select: 0,
        fade: 0,
        pxPerUnit: 1,
        inFront: true,
      })),
    });
    const m = materialsRef.current;
    if (mode === 'prewarm') {
      for (const c of archive.cards) c.fade = 1;
      return;
    }
    const rt = runtime?.current;
    if (!rt) return;
    const dt = Math.min(delta, 0.1);
    const i = node.index;
    archive.time = rt.time;
    archive.animated = rt.animated;
    const fade = smoothstep(0.15, 0.85, rt.focus[i] ?? 0) * (compiled ? 1 : 0);
    group.visible = fade > 0.002;
    if (fade > 0.5) busRef?.current.readyContent.add(ARCHIVE_READY_KEY);
    else busRef?.current.readyContent.delete(ARCHIVE_READY_KEY);
    m.uniforms.uTime.value = rt.time;
    const { world, rel, forward, toCard } = scratch.current;
    world.set(node.position[0], node.position[1], node.position[2]);
    const offset = rt.offsets[i];
    if (offset) world.add(offset);
    m.uniforms.uCorePos.value.copy(world);
    m.rings.uniforms.uIntensity.value = fade * (focusedProject ? 0.45 : 1);

    const hoverK = dampFactor(MOTION.hoverRate, dt);
    const dimK = rt.animated ? dampFactor(DIM_RATE, dt) : 1;
    const targets = archiveCardTargets(
      node.projects,
      highlightRef.current,
      focusedProject,
      active ? emphasisRef.current : null,
    );
    const cam = state.camera;
    cam.getWorldDirection(forward);
    const fov = isPerspectiveCamera(cam) ? cam.fov : 50;
    const bus = busRef?.current;
    // Free frame in canvas px: cards mostly outside it (under the HUD, the
    // sheet or the viewport edge) fade instead of showing clipped (V5-06).
    const rect = useSceneStore.getState().safeRect;
    const frameLeft = rect ? rect.x - state.size.left : 0;
    const frameTop = rect ? rect.y - state.size.top : 0;
    const frameRight = rect ? frameLeft + rect.width : state.size.width;
    const frameBottom = rect ? frameTop + rect.height : state.size.height;
    node.projects.forEach((project, index) => {
      const c = archive.cards[index]!;
      const target = targets[index]!;
      // Screen position (CSS px, canvas space) for the labels and the presence.
      const p = rel.set(
        world.x + project.offset[0],
        world.y + project.offset[1],
        world.z + project.offset[2],
      );
      const depth = toCard.subVectors(p, cam.position).dot(forward);
      c.pxPerUnit = pixelsPerUnit(state.size.height, fov, depth);
      p.project(cam);
      c.inFront = p.z < 1;
      const sx = (p.x * 0.5 + 0.5) * state.size.width;
      const sy = (0.5 - p.y * 0.5) * state.size.height;
      const halfW = (ARCHIVE.cardWidth / 2) * c.pxPerUnit;
      const halfH = (ARCHIVE.cardHeight / 2) * c.pxPerUnit;
      const overlapW = Math.max(
        0,
        Math.min(sx + halfW, frameRight) - Math.max(sx - halfW, frameLeft),
      );
      const overlapH = Math.max(
        0,
        Math.min(sy + halfH, frameBottom) - Math.max(sy - halfH, frameTop),
      );
      const inside = halfW > 0 && halfH > 0 ? (overlapW * overlapH) / (4 * halfW * halfH) : 1;
      const presence = project.slug === focusedProject ? 1 : smoothstep(0.55, 0.92, inside);

      c.hover += (target.hover - c.hover) * hoverK;
      c.dim += (Math.max(Math.min(target.dim, presence), c.hover) - c.dim) * dimK;
      c.select += (target.select - c.select) * dimK;
      c.fade = fade;
      const u = m.cards[index]?.uniforms;
      if (u) {
        u.uHover.value = c.hover;
        u.uFade.value = fade;
        u.uDim.value = c.dim;
        u.uSelect.value = c.select;
      }
      bus?.projectTargets.set(project.slug, {
        x: sx,
        y: sy,
        // The label reticle (2 × radius) hugs the card's corners.
        radiusPx: (ARCHIVE.cardHeight / 2) * 0.53 * c.pxPerUnit,
        pxPerUnit: c.pxPerUnit,
        inFront: c.inFront,
        visible: fade > 0.5 && c.dim > 0.15,
        label: project.label,
        sub: project.categoryLabels.join(' · ') || null,
        color: project.color,
        ordinal: project.ordinal,
        total: node.projects.length,
      });
    });
  }, -0.25);

  return (
    <group ref={groupRef} visible={mode === 'prewarm'}>
      <lineSegments
        geometry={rings}
        material={materials.rings}
        position={center}
        quaternion={ringsQuaternion}
        frustumCulled={false}
        renderOrder={2}
      />
      {node.projects.map((project, index) => {
        const cardMaterials = materials.cards[index];
        const emblemGeometry = emblemGeometries.get(project.emblem);
        if (!cardMaterials || !emblemGeometry) return null;
        return (
          <ArchiveCard
            key={project.slug}
            project={project}
            index={index}
            materials={cardMaterials}
            slab={card.slab}
            edges={card.edges}
            emblemGeometry={emblemGeometry}
            emblem={emblemFor(project.emblem)}
            stateRef={stateRef}
            mode={mode}
            focused={project.slug === focusedProject}
            replace={focusedProject !== null}
            busRef={busRef}
            onNavigate={onNavigate}
          />
        );
      })}
    </group>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}
