'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneStore } from '@/store/scene';
import {
  SCENE_STATS_INTERVAL_MS,
  isSceneDebugEnabled,
  type SceneStats as Stats,
} from './scene-stats';

interface Sampler {
  calls: number;
  triangles: number;
  frameSum: number;
  frames: number;
  lastFrame: number;
  lastPublish: number;
}

/**
 * Publishes `window.__sceneStats` (and the `window.__sceneDebug` controls)
 * when the page was opened with `?debug=1`
 * (checked once on mount, so the hook survives client-side navigations that
 * drop the query). No-op otherwise. Renderer info is accumulated manually
 * (`info.autoReset = false`) so multi-pass frames (post-processing) are summed.
 */
export function SceneStats() {
  const getState = useThree((state) => state.get);
  const enabled = useRef(false);
  const configured = useRef(false);
  const sampler = useRef<Sampler>({
    calls: 0,
    triangles: 0,
    frameSum: 0,
    frames: 0,
    lastFrame: 0,
    lastPublish: 0,
  });

  useEffect(() => {
    if (!isSceneDebugEnabled(window.location.search)) return;
    enabled.current = true;
    window.__sceneDebug = { setEmphasis: (ids) => useSceneStore.getState().setEmphasis(ids) };
    return () => {
      delete window.__sceneDebug;
      enabled.current = false;
      if (configured.current) {
        configured.current = false;
        getState().gl.info.autoReset = true;
      }
      delete window.__sceneStats;
    };
  }, [getState]);

  // Lowest priority value → runs first, before this frame's render.
  useFrame((state) => {
    if (!enabled.current) return;
    const s = sampler.current;
    const info = state.gl.info;
    if (!configured.current) {
      configured.current = true;
      info.autoReset = false;
      info.reset();
      return;
    }
    // Totals of the previous frame (all render calls since the last reset).
    s.calls = info.render.calls;
    s.triangles = info.render.triangles;
    info.reset();

    const now = performance.now();
    // Skip the gap after a paused loop (hidden tab) so it does not skew the average.
    if (s.lastFrame > 0 && now - s.lastFrame < 1000) {
      s.frameSum += now - s.lastFrame;
      s.frames += 1;
    }
    s.lastFrame = now;

    if (now - s.lastPublish >= SCENE_STATS_INTERVAL_MS) {
      const stats: Stats = {
        calls: s.calls,
        triangles: s.triangles,
        programs: info.programs?.length ?? 0,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        frameMs: s.frames > 0 ? Math.round((s.frameSum / s.frames) * 100) / 100 : 0,
      };
      window.__sceneStats = stats;
      s.lastPublish = now;
      s.frameSum = 0;
      s.frames = 0;
    }
  }, -100);

  return null;
}
