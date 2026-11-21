'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Vector3, type Group, type ShaderMaterial } from 'three';
import type { SceneBusRef } from '../bus';
import { PALETTE } from '../config';
import { ArchiveContent } from '../portfolio/ArchiveContent';
import type { ArchiveMaterialCache } from '../portfolio/archive-materials';
import { ARCHIVE_PREWARM_KEY, type CompileApiRef, type PrewarmApiRef } from '../prewarm/api';
import { COMPILE_PRIORITY } from '../prewarm/compile-queue';
import { qualityDefines, type QualityPreset } from '../quality';
import { createRandom } from '../random';
import { clusterFragment, clusterVertex } from '../shaders/cluster';
import { fogUniforms, pointScale } from '../three-utils';
import { Halo } from './Halo';
import { HitZone } from './HitZone';
import type { PortfolioNodeModel } from './model';
import { neighbourDim, type UniverseRuntimeRef } from './runtime';

/** Plummer scale radius and cut-off of the cluster, world units. */
const CORE_RADIUS = 0.85;
const MAX_RADIUS = 3.1;
const STAR_COLORS = [PALETTE.portfolio, '#C8D5FF', PALETTE.portfolioGlow, '#FFF0DC'] as const;

interface PortfolioClusterProps {
  node: PortfolioNodeModel;
  runtime: UniverseRuntimeRef;
  preset: QualityPreset;
  /** The URL is on the portfolio or one of its projects. */
  focused: boolean;
  /** Slug of the project the URL focuses, else null. */
  focusedProject: string | null;
  onNavigate: (path: string, replace?: boolean) => void;
  busRef: SceneBusRef;
  prewarm: PrewarmApiRef;
  compile: CompileApiRef;
  archiveMaterials: ArchiveMaterialCache;
}

/**
 * Distant silver globular cluster — the portfolio "archive". One brighter star
 * per visible project; with no published projects the cluster stays dimmer
 * and its label adds "coming soon" (BRIEF B2.3, see NodeLabels). While the
 * URL is on the portfolio (or the flight in or out is visible) the archive
 * view is mounted: the project card-objects and the observatory rings.
 */
export function PortfolioCluster({
  node,
  runtime,
  preset,
  focused,
  focusedProject,
  onNavigate,
  busRef,
  prewarm,
  compile,
  archiveMaterials,
}: PortfolioClusterProps) {
  const groupRef = useRef<Group>(null);
  const archiveWanted = useRef(false);
  const scratch = useRef({ card: new Vector3(), forward: new Vector3() });
  const [fading, setFading] = useState(false);
  const spinRef = useRef<Group>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const projectCount = node.projectSlugs.length;

  const data = useMemo(
    () => buildCluster(preset.clusterPoints, projectCount),
    [preset.clusterPoints, projectCount],
  );

  const uniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uTime: { value: 0 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
      uEmphasis: { value: 0 },
      uBrightness: { value: node.comingSoon ? 0.68 : 1 },
      uNearCut: { value: 0 },
    }),
    [node.comingSoon],
  );

  useFrame((state) => {
    const rt = runtime.current;
    if (!rt) return;
    const group = groupRef.current;
    if (group) {
      const offset = rt.offsets[node.index];
      group.position.set(node.position[0], node.position[1], node.position[2]);
      if (offset) group.position.add(offset);
    }
    if (spinRef.current) spinRef.current.rotation.y = rt.time * 0.02;
    const material = materialRef.current;
    if (material) {
      material.uniforms.uTime.value = rt.time;
      material.uniforms.uEmphasis.value = rt.emphasis[node.index] ?? 0;
      material.uniforms.uScale.value = pointScale(state);
      material.uniforms.uPixelRatio.value = state.viewport.dpr;
      // With cards on show the cluster steps back into a backdrop.
      const backdrop = node.comingSoon ? 1 : 1 - 0.35 * (rt.focus[node.index] ?? 0);
      // A focused card: stars between it and the camera fade (clean card face).
      const focusedCard = focusedProject
        ? node.projects.find((project) => project.slug === focusedProject)
        : undefined;
      let nearCut = 0;
      if (focusedCard && group) {
        const { card, forward } = scratch.current;
        card.set(...focusedCard.offset).add(group.position);
        state.camera.getWorldDirection(forward);
        nearCut = card.sub(state.camera.position).dot(forward) * (rt.focus[node.index] ?? 0);
      }
      material.uniforms.uNearCut.value = nearCut;
      material.uniforms.uBrightness.value =
        (node.comingSoon ? 0.68 : 1) *
        backdrop *
        neighbourDim(rt, node.index, 0.45) *
        (rt.presence[node.index] ?? 1);
    }
    // Keep the archive mounted while the flight in or out is visible.
    const wanted = (rt.focus[node.index] ?? 0) > 0.002;
    if (wanted !== archiveWanted.current) {
      archiveWanted.current = wanted;
      setFading(wanted);
    }
  });

  const showArchive = focused || fading;

  return (
    <group ref={groupRef} position={node.position}>
      <group ref={spinRef} rotation={[0.35, 0, 0.18]}>
        <points frustumCulled={false} renderOrder={3}>
          <bufferGeometry key={`cluster-${data.count}`}>
            <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[data.sizes, 1]} />
            <bufferAttribute attach="attributes-aKind" args={[data.kinds, 1]} />
            <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
            <bufferAttribute attach="attributes-aColor" args={[data.colors, 3]} />
          </bufferGeometry>
          <shaderMaterial
            key={preset.lowQualityShaders ? 'low' : 'full'}
            ref={materialRef}
            uniforms={uniforms}
            vertexShader={clusterVertex}
            fragmentShader={clusterFragment}
            defines={qualityDefines(preset)}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
      <Halo
        color={PALETTE.portfolio}
        glow={PALETTE.portfolioGlow}
        size={4.6}
        lift={0}
        intensity={node.comingSoon ? 0.28 : 0.42}
        runtime={runtime}
        index={node.index}
        preset={preset}
        fadeOnFocus={!node.comingSoon}
      />
      {showArchive ? (
        <ArchiveContent
          node={node}
          preset={preset}
          materials={archiveMaterials.get(node, preset.lowQualityShaders)}
          mode="live"
          runtime={runtime}
          compile={compile}
          busRef={busRef}
          focusedProject={focusedProject}
          active={focused}
          onNavigate={onNavigate}
          priority={focused ? COMPILE_PRIORITY.boot : COMPILE_PRIORITY.live}
        />
      ) : null}
      <HitZone
        radius={3.6}
        nodeKey={node.key}
        path={node.path}
        onNavigate={onNavigate}
        busRef={busRef}
        runtime={runtime}
        index={node.index}
        prewarm={prewarm}
        prewarmKey={ARCHIVE_PREWARM_KEY}
      />
    </group>
  );
}

function buildCluster(backgroundCount: number, projectCount: number) {
  const random = createRandom(0x5ca1ab1e);
  const count = backgroundCount + projectCount;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const kinds = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const tint = new Color();

  for (let i = 0; i < count; i++) {
    const isProject = i >= backgroundCount;
    let radius: number;
    let x: number;
    let y: number;
    let z: number;
    if (isProject) {
      // Fibonacci sphere: project stars evenly spread inside the cluster.
      const k = i - backgroundCount;
      const yy = 1 - ((k + 0.5) / Math.max(projectCount, 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - yy * yy));
      const theta = k * 2.399963;
      radius = 1.15;
      x = Math.cos(theta) * ring;
      y = yy;
      z = Math.sin(theta) * ring;
    } else {
      // Plummer profile: dense core, sparse halo.
      const u = 0.02 + random() * 0.96;
      radius = Math.min(CORE_RADIUS / Math.sqrt(Math.pow(u, -2 / 3) - 1), MAX_RADIUS);
      const cosTheta = random() * 2 - 1;
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      const phi = random() * Math.PI * 2;
      x = Math.cos(phi) * sinTheta;
      y = cosTheta;
      z = Math.sin(phi) * sinTheta;
    }
    positions[i * 3] = x * radius;
    positions[i * 3 + 1] = y * radius * 0.92;
    positions[i * 3 + 2] = z * radius;
    sizes[i] = isProject ? 0.34 : 0.05 + Math.pow(random(), 3) * 0.13;
    kinds[i] = isProject ? 1 : 0;
    phases[i] = random();
    tint.set(isProject ? PALETTE.portfolioGlow : STAR_COLORS[Math.floor(random() * 4) % 4]!);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  return { positions, sizes, kinds, phases, colors, count };
}
