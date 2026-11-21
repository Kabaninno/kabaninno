'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferGeometry, Group, Mesh } from 'three';
import type { SceneBusRef } from '../bus';
import { HitZone } from '../universe/HitZone';
import type { ArchiveProjectModel } from '../universe/model';
import { ARCHIVE, CARD_RADIUS } from './archive-layout';
import type { CardMaterials } from './archive-materials';
import type { EmblemEntry } from './emblems';

/** Per-card state, written by ArchiveContent before the cards read it. */
export interface CardRuntime {
  /** Eased hover (3D or `project:<slug>` highlight), 0..1. */
  hover: number;
  /** Brightness: siblings of a focused project and cards outside the filter recede. */
  dim: number;
  /** Filter emphasis (D87), 0..1. */
  select: number;
  /** Materialized with the portfolio focus, 0..1. */
  fade: number;
  /** CSS px per world unit at the card (hit zone minimum size). */
  pxPerUnit: number;
  inFront: boolean;
}

export interface ArchiveRuntime {
  time: number;
  /** Ambient motion runs (false under prefers-reduced-motion). */
  animated: boolean;
  cards: CardRuntime[];
}

/** Minimum hit-zone diameter on screen (touch target), CSS px. */
const MIN_HIT_PX = 44;
/** Emblem size (bounding radius, world units) and its place on the card face. */
const EMBLEM_RADIUS = 0.3;
const EMBLEM_Y = 0.28;
const EMBLEM_Z = 0.2;

interface ArchiveCardProps {
  project: ArchiveProjectModel;
  index: number;
  materials: CardMaterials;
  slab: BufferGeometry;
  edges: BufferGeometry;
  emblemGeometry: BufferGeometry;
  emblem: EmblemEntry;
  /** Shared archive state (read in useFrame only). */
  stateRef: RefObject<ArchiveRuntime | null>;
  mode: 'live' | 'prewarm';
  /** The URL focuses this card (its hit zone is off: N3). */
  focused: boolean;
  /** Project route: a sibling replaces the history entry (D16). */
  replace: boolean;
  busRef?: SceneBusRef;
  onNavigate?: (path: string, replace?: boolean) => void;
}

/**
 * One project card-object: a glass slab with a holographic face, a glowing
 * outline, the main category's emblem floating in front and a soft glow
 * behind. It turns toward the viewer with a slight idle sway, so its face
 * stays readable from wherever the visitor orbits.
 */
export function ArchiveCard({
  project,
  index,
  materials,
  slab,
  edges,
  emblemGeometry,
  emblem,
  stateRef,
  mode,
  focused,
  replace,
  busRef,
  onNavigate,
}: ArchiveCardProps) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const emblemRef = useRef<Mesh>(null);
  const hitRef = useRef<Group>(null);
  // Uniform writes go through a ref (the cached materials are shared objects).
  const materialsRef = useRef(materials);
  useEffect(() => {
    materialsRef.current = materials;
  }, [materials]);

  useFrame((state) => {
    const archive = stateRef.current;
    const card = archive?.cards[index];
    const group = groupRef.current;
    if (!archive || !card || !group) return;
    const time = archive.time;
    const seed = index * 1.37;
    // Face the viewer, then sway a little so the glass catches the light.
    group.lookAt(state.camera.position);
    if (archive.animated) {
      group.rotateY(Math.sin(time * 0.31 + seed) * 0.12);
      group.rotateX(Math.sin(time * 0.23 + seed * 1.7) * 0.05);
    }
    bodyRef.current?.scale.setScalar((0.7 + 0.3 * card.fade) * (1 + 0.05 * card.hover));
    const emblemMesh = emblemRef.current;
    if (emblemMesh) {
      emblemMesh.rotation.set(emblem.tilt[0], emblem.tilt[1] + time * emblem.spin, emblem.tilt[2]);
    }
    const m = materialsRef.current;
    m.glow.uniforms.uIntensity.value =
      (0.32 + 0.25 * card.select + 0.4 * card.hover) * card.fade * card.dim;
    hitRef.current?.scale.setScalar(
      Math.max(CARD_RADIUS * 1.05, MIN_HIT_PX / 2 / Math.max(card.pxPerUnit, 1e-3)),
    );
  });

  const gate = () => {
    const card = stateRef.current?.cards[index];
    return (
      !!busRef?.current.archiveInteractive &&
      !focused &&
      !!card &&
      card.fade > 0.5 &&
      card.dim > 0.15 &&
      card.inFront
    );
  };

  return (
    <group ref={groupRef} position={project.offset}>
      <group ref={bodyRef}>
        <mesh geometry={slab} material={materials.card} renderOrder={4} />
        <lineSegments geometry={edges} material={materials.edges} renderOrder={5} />
        <mesh
          ref={emblemRef}
          geometry={emblemGeometry}
          material={materials.emblem}
          position={[0, EMBLEM_Y, EMBLEM_Z]}
          scale={EMBLEM_RADIUS}
        />
        <mesh material={materials.glow} frustumCulled={false} renderOrder={3}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      </group>
      {mode === 'live' && busRef && onNavigate ? (
        <group ref={hitRef}>
          <HitZone
            radius={1}
            nodeKey={project.key}
            path={project.path}
            onNavigate={onNavigate}
            replace={replace}
            gate={gate}
            busRef={busRef}
          />
        </group>
      ) : null}
    </group>
  );
}

/** Card half extents, exported for framing helpers and tests. */
export const CARD_HALF = { x: ARCHIVE.cardWidth / 2, y: ARCHIVE.cardHeight / 2 } as const;
