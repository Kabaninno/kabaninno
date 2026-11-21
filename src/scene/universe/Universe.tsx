'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '@/store/scene';
import { MOTION } from '../config';
import { dampFactor } from '../camera/damp';
import { universeKeyForHighlight } from '../node-ids';
import type { QualityPreset } from '../quality';
import { motionTime } from '../three-utils';
import { CategoryNode } from './CategoryNode';
import { ConfiguratorBeacon } from './ConfiguratorBeacon';
import { Links } from './Links';
import type { UniverseModel } from './model';
import { PortfolioCluster } from './PortfolioCluster';
import {
  DRIFT_AMPLITUDE,
  createUniverseRuntime,
  writeDrift,
  type UniverseRuntime,
} from './runtime';

/** Network visibility while the camera is focused on a node (art direction: "the network fades"). */
const FOCUSED_NETWORK = 0.18;

interface UniverseProps {
  model: UniverseModel;
  /** Universe node the URL focuses (null = overview). */
  focusKey: string | null;
  preset: QualityPreset;
  reducedMotion: boolean;
  onNavigate: (path: string) => void;
}

/**
 * The universe network: category nodes, portfolio cluster, configurator beacon
 * and links. Owns the per-frame runtime (drift, eased hover/focus) that every
 * child reads, so hover and highlight never cause React re-renders.
 */
export function Universe({ model, focusKey, preset, reducedMotion, onNavigate }: UniverseProps) {
  const runtime = useRef<UniverseRuntime | null>(null);
  // Highlight id from the shared store (3D hover or HTML nav focus), kept in a ref.
  const highlightRef = useRef<string | null>(null);

  useEffect(() => {
    highlightRef.current = universeKeyForHighlight(useSceneStore.getState().highlighted);
    return useSceneStore.subscribe((state) => {
      highlightRef.current = universeKeyForHighlight(state.highlighted);
    });
  }, []);

  // Runs before the node components (priority -1) so they read fresh values.
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const time = motionTime(state, reducedMotion);
    const hoverK = dampFactor(MOTION.hoverRate, dt);
    const focusK = dampFactor(MOTION.focusRate, dt);
    const highlighted = highlightRef.current;
    const rt = runtime.current ?? (runtime.current = createUniverseRuntime());

    rt.time = time;
    rt.animated = !reducedMotion;
    for (const node of model.nodes) {
      const i = node.index;
      const hover = rt.hover[i]! + ((node.key === highlighted ? 1 : 0) - rt.hover[i]!) * hoverK;
      const focus = rt.focus[i]! + ((node.key === focusKey ? 1 : 0) - rt.focus[i]!) * focusK;
      rt.hover[i] = hover;
      rt.focus[i] = focus;
      rt.emphasis[i] = Math.max(hover, focus * 0.45);
      writeDrift(rt.offsets[i]!, i, time, DRIFT_AMPLITUDE * (1 - focus));
    }
    const networkTarget = focusKey ? FOCUSED_NETWORK : 1;
    rt.network += (networkTarget - rt.network) * focusK;
  }, -1);

  return (
    <group>
      <Links model={model} runtime={runtime} preset={preset} />
      {model.categories.map((node) => (
        <CategoryNode
          key={node.key}
          node={node}
          runtime={runtime}
          preset={preset}
          onNavigate={onNavigate}
        />
      ))}
      <PortfolioCluster
        node={model.portfolio}
        runtime={runtime}
        preset={preset}
        onNavigate={onNavigate}
      />
      <ConfiguratorBeacon
        node={model.configurator}
        runtime={runtime}
        preset={preset}
        onNavigate={onNavigate}
      />
    </group>
  );
}
