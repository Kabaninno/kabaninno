'use client';

import { useEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSceneStore } from '@/store/scene';

/** Pointer travel (px) above which a press is treated as a drag, not a click. */
const CLICK_TOLERANCE_PX = 8;

interface HitZoneProps {
  radius: number;
  /** Highlight id written to the scene store on hover (see node-ids.ts). */
  nodeKey: string;
  /** Locale-less route opened on click; null disables navigation. */
  path: string | null;
  onNavigate: (path: string) => void;
}

/**
 * Invisible, enlarged hit sphere for a node. Raycasting ignores `visible`, so
 * the mesh costs no draw call. Hover writes the shared highlight (the HTML
 * navigation reads the same store); touch taps skip hover and just navigate.
 */
export function HitZone({ radius, nodeKey, path, onNavigate }: HitZoneProps) {
  const hovered = useRef(false);

  useEffect(
    () => () => {
      if (!hovered.current) return;
      document.body.style.cursor = '';
      const store = useSceneStore.getState();
      if (store.highlighted === nodeKey) store.setHighlighted(null);
    },
    [nodeKey],
  );

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    hovered.current = true;
    if (path) document.body.style.cursor = 'pointer';
    if (event.nativeEvent.pointerType !== 'touch') {
      useSceneStore.getState().setHighlighted(nodeKey);
    }
  };

  const handleOut = () => {
    hovered.current = false;
    document.body.style.cursor = '';
    const store = useSceneStore.getState();
    if (store.highlighted === nodeKey) store.setHighlighted(null);
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!path || event.delta > CLICK_TOLERANCE_PX) return;
    onNavigate(path);
  };

  return (
    <mesh visible={false} onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
      <sphereGeometry args={[radius, 16, 12]} />
      {/* Never rendered (visible=false); Mesh.raycast only requires a material. */}
      <meshBasicMaterial />
    </mesh>
  );
}
