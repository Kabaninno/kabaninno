'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type RootState } from '@react-three/fiber';
import { useRouter } from '@/i18n/navigation';
import { useSceneStore } from '@/store/scene';
import { CameraRig } from './camera/CameraRig';
import { CAMERA, MOTION } from './config';
import { SceneStats } from './debug/SceneStats';
import { useDocumentVisible } from './hooks/useDocumentVisible';
import { useFinePointer, useReducedMotion } from './hooks/useMediaQuery';
import { focusKeyForTarget } from './node-ids';
import { QUALITY_PRESETS } from './quality';
import { filterR3fClockDeprecation } from './three-console';
import type { SceneManifest } from './types';
import { buildUniverseModel } from './universe/model';
import { Starfield } from './universe/Starfield';
import { Universe } from './universe/Universe';
import { useSceneTarget } from './useSceneTarget';

// Before any R3F root exists (see three-console.ts: the warning is R3F's, not ours).
filterR3fClockDeprecation();

/*
 * Canvas configuration lives in module constants: R3F re-applies changed
 * root props on every render, and inline objects/arrays would look "changed".
 */
const DPR: [number, number] = [1, 2];
const GL_PROPS = {
  alpha: true,
  antialias: true,
  stencil: false,
  powerPreference: 'high-performance',
} as const;
/** Position/orientation are owned by CameraRig from the first frame on. */
const CAMERA_PROPS = { fov: CAMERA.fov, near: 0.1, far: CAMERA.far } as const;

function createInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function handleCreated(state: RootState) {
  const canvas = state.gl.domElement;
  // Marker for automated checks: stays constant while the canvas is not remounted.
  if (!canvas.dataset.sceneInstance) canvas.dataset.sceneInstance = createInstanceId();
  // Transparent clear: the CSS backdrop (void → deep gradient) shows through.
  state.gl.setClearColor(0x000000, 0);
}

/**
 * The persistent 3D layer (loaded client-only by SceneRoot). Where the camera
 * goes is derived from the URL on every render; nothing here mirrors it.
 */
export default function Experience({ manifest }: { manifest: SceneManifest }) {
  const target = useSceneTarget();
  const router = useRouter();
  const visible = useDocumentVisible();
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const quality = useSceneStore((state) => state.quality);
  const [ready, setReady] = useState(false);

  const model = useMemo(() => buildUniverseModel(manifest), [manifest]);
  const preset = QUALITY_PRESETS[quality];
  const focusKey = focusKeyForTarget(target);

  const navigate = useCallback((path: string) => router.push(path), [router]);
  const handleFirstFrame = useCallback(() => setReady(true), []);

  return (
    <Canvas
      dpr={DPR}
      gl={GL_PROPS}
      camera={CAMERA_PROPS}
      flat
      frameloop={visible ? 'always' : 'never'}
      onCreated={handleCreated}
      style={{
        opacity: ready ? 1 : 0,
        transition: `opacity ${reducedMotion ? MOTION.reducedCutMs : MOTION.fadeInMs}ms ease-out`,
      }}
    >
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
      <Starfield preset={preset} reducedMotion={reducedMotion} />
      <Universe
        model={model}
        focusKey={focusKey}
        preset={preset}
        reducedMotion={reducedMotion}
        onNavigate={navigate}
      />
      <CameraRig
        target={target}
        model={model}
        reducedMotion={reducedMotion}
        finePointer={finePointer}
      />
      <SceneStats />
    </Canvas>
  );
}

/** Calls `onFirstFrame` once, right before the first frame is drawn. */
function FirstFrameSignal({ onFirstFrame }: { onFirstFrame: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onFirstFrame();
  });
  return null;
}
