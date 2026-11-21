'use client';

import { useEffect, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useSceneStore } from '@/store/scene';
import type { SceneBusRef } from '../bus';
import type { PrewarmApiRef } from '../prewarm/api';
import type { UniverseRuntimeRef } from './runtime';

/** Pointer travel (px) above which a press is treated as a drag, not a click. */
const CLICK_TOLERANCE_PX = 8;
/** Raycaster layer that nothing tests: disables the zone without unmounting it. */
const DISABLED_LAYER = 31;

let hoverQuery: MediaQueryList | null = null;
/** Hover highlights need a hover-capable primary pointer (not phones, even with a mouse event). */
function canHover(): boolean {
  hoverQuery ??= window.matchMedia('(hover: hover)');
  return hoverQuery.matches;
}

interface HitZoneProps {
  /** Sphere radius; parents may also scale the zone every frame. */
  radius: number;
  /** Highlight id written to the scene store on hover (see node-ids.ts). */
  nodeKey: string;
  /** Locale-less route opened on click; null disables navigation. */
  path: string | null;
  onNavigate: (path: string) => void;
  busRef: SceneBusRef;
  /** With `index`: the zone also needs the node's presence (not faded out under an overlay). */
  runtime?: UniverseRuntimeRef;
  index?: number;
  prewarm?: PrewarmApiRef;
  /** Prewarm key of the content behind this node (desktop hover, touchstart). */
  prewarmKey?: string;
}

/**
 * Invisible, enlarged hit sphere for a node. Raycasting ignores `visible`, so
 * the mesh costs no draw call. Mouse hover writes the shared highlight (the
 * HTML navigation reads the same store); touch taps skip hover and navigate.
 *
 * The zone only works while `bus.interactive` (overview, camera settled):
 * during flights it leaves the raycaster's layer, and its highlight and
 * cursor are withdrawn. `hovered` keeps mirroring R3F's own hover state, so
 * when the zone comes back and the director refreshes the pointer (QA N3a),
 * a still pointer over the node re-highlights it and a node that moved away
 * gets its pointer-out.
 */
export function HitZone({
  radius,
  nodeKey,
  path,
  onNavigate,
  busRef,
  runtime,
  index,
  prewarm,
  prewarmKey,
}: HitZoneProps) {
  const meshRef = useRef<Mesh>(null);
  const hovered = useRef(false);
  const mouse = useRef(false);
  const applied = useRef(false);
  const enabled = useRef(true);

  const apply = (active: boolean) => {
    if (active === applied.current) return;
    applied.current = active;
    const store = useSceneStore.getState();
    if (active) {
      if (path) document.body.style.cursor = 'pointer';
      if (mouse.current) store.setHighlighted(nodeKey);
    } else {
      if (path) document.body.style.cursor = '';
      if (store.highlighted === nodeKey) store.setHighlighted(null);
    }
  };

  useEffect(
    () => () => {
      if (!applied.current) return;
      if (path) document.body.style.cursor = '';
      const store = useSceneStore.getState();
      if (store.highlighted === nodeKey) store.setHighlighted(null);
    },
    [nodeKey, path],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const presence = index === undefined ? 1 : (runtime?.current?.presence[index] ?? 1);
    const interactive = busRef.current.interactive && presence > 0.5;
    if (interactive !== enabled.current) {
      enabled.current = interactive;
      if (interactive) mesh.layers.enableAll();
      else mesh.layers.set(DISABLED_LAYER);
      apply(interactive && hovered.current);
    }
  });

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hovered.current = true;
    mouse.current = event.nativeEvent.pointerType !== 'touch' && canHover();
    if (mouse.current && prewarmKey) prewarm?.current?.prioritize(prewarmKey);
    apply(enabled.current);
  };

  const handleOut = () => {
    hovered.current = false;
    apply(false);
  };

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    // Touch has no hover: warm the system up on touchstart, before the tap completes.
    if (event.nativeEvent.pointerType === 'touch' && prewarmKey) {
      prewarm?.current?.prioritize(prewarmKey);
    }
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!path || !enabled.current || event.delta > CLICK_TOLERANCE_PX) return;
    onNavigate(path);
  };

  return (
    <mesh
      ref={meshRef}
      visible={false}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onPointerDown={handleDown}
      onClick={handleClick}
    >
      <sphereGeometry args={[radius, 16, 12]} />
      {/* Never rendered (visible=false); Mesh.raycast only requires a material. */}
      <meshBasicMaterial />
    </mesh>
  );
}
