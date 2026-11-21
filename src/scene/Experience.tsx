'use client';

import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Canvas, useFrame, useThree, type GLProps, type RootState } from '@react-three/fiber';
import { useRouter } from '@/i18n/navigation';
import { sceneStateToPath } from '@/lib/route-state';
import { useSceneStore, type QualityTier } from '@/store/scene';
import { createSceneBus, keepAlive, type SceneBusRef } from './bus';
import { CameraDirector } from './camera/CameraDirector';
import { CAMERA, MOTION, PALETTE } from './config';
import { SceneStats } from './debug/SceneStats';
import { useDocumentVisible } from './hooks/useDocumentVisible';
import { useFinePointer, useReducedMotion } from './hooks/useMediaQuery';
import { focusKeyForTarget } from './node-ids';
import { QualityManager } from './perf/QualityManager';
import type { CompileApi, PrewarmApi } from './prewarm/api';
import { CompileService } from './prewarm/CompileService';
import { Prewarm } from './prewarm/Prewarm';
import { buildPrewarmEntries } from './prewarm/registry';
import { SystemMaterialCache } from './prewarm/system-materials';
import {
  QUALITY_PRESETS,
  initialQualityTier,
  parseQualityOverride,
  sceneDpr,
  stepQuality,
} from './quality';
import { createSceneRenderer } from './renderer';
import { filterR3fClockDeprecation } from './three-console';
import type { SceneManifest } from './types';
import { Backdrop } from './universe/Backdrop';
import { buildUniverseModel } from './universe/model';
import { Reveal } from './universe/Reveal';
import { Starfield } from './universe/Starfield';
import { Universe } from './universe/Universe';
import { useSceneTarget } from './useSceneTarget';

// Before any R3F root exists (see three-console.ts: the warning is R3F's, not ours).
filterR3fClockDeprecation();

/** Bloom lives in its own lazily loaded chunk (postprocessing). */
const Effects = lazy(() => import('./post/Effects').catch(() => ({ default: NoEffects })));

/** Stand-in when the effects chunk cannot load: the boot just continues. */
function NoEffects({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

/** The async renderer factory form of R3F's `gl` prop. */
type RendererFactory = Extract<GLProps, (defaults: never) => Promise<unknown>>;

/** Position/orientation are owned by the camera director from the first frame on. */
const CAMERA_PROPS = { fov: CAMERA.fov, near: 0.1, far: CAMERA.far } as const;
/**
 * Hard fallback of the staged boot: whatever the compile queue, the effects
 * chunk or the frame rate are doing, everything is mounted and the canvas
 * fades in at most this long after the first frame (by a plain timer, so a
 * slow or stalled queue can never keep the scene invisible).
 */
const REVEAL_DEADLINE_MS = 1500;

/**
 * Boot stages (perf P-01b), each mounted in its own task:
 * 0 — backdrop, stars and camera (the first frame compiles only those);
 * 1 — bloom composer (lazy chunk), when the tier has bloom;
 * 2 — the universe, mounted hidden and compiled through the queue;
 * 3 — revealed: canvas fade-in, then prewarm and quality adaptation.
 * REVEAL_DEADLINE_MS after the first frame, stage 3 and the fade-in are
 * forced (the remaining programs then compile on first draw, as before).
 */
type BootStage = 0 | 1 | 2 | 3;

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
  state.gl.setClearColor(PALETTE.void, 1);
}

function deviceHints() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
  };
}

/** Live devicePixelRatio (zoom, moving the window to another display). */
function subscribeDpr(onChange: () => void) {
  let query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const handle = () => {
    query.removeEventListener('change', handle);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', handle);
    onChange();
  };
  query.addEventListener('change', handle);
  return () => query.removeEventListener('change', handle);
}
const readDpr = () => window.devicePixelRatio || 1;

interface ExperienceProps {
  manifest: SceneManifest;
  /** The WebGL context could not be created: SceneRoot continues without 3D. */
  onUnavailable: () => void;
}

/**
 * The persistent 3D layer (loaded client-only by SceneRoot). Where the camera
 * goes is derived from the URL on every render; nothing here mirrors it.
 */
export default function Experience({ manifest, onUnavailable }: ExperienceProps) {
  const target = useSceneTarget();
  const path = useMemo(() => sceneStateToPath(target), [target]);
  const router = useRouter();
  const visible = useDocumentVisible();
  const reducedMotion = useReducedMotion();
  const finePointer = useFinePointer();
  const deviceDpr = useSyncExternalStore(subscribeDpr, readDpr, () => 1);
  // `?quality=` pins the tier (screenshots in headless browsers); read once.
  const [pinnedQuality] = useState(() => parseQualityOverride(window.location.search));
  // The tier is decided before the first render (no costly switch at boot) and
  // only steps down afterwards (QualityManager).
  const [tier, setTier] = useState<QualityTier>(
    () => pinnedQuality ?? initialQualityTier(deviceHints()),
  );
  const [stage, setStage] = useState<BootStage>(0);
  const [revealed, setRevealed] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const deadlineTimer = useRef<number | null>(null);
  const busRef = useRef(createSceneBus());
  const prewarmRef = useRef<PrewarmApi | null>(null);
  const compileRef = useRef<CompileApi | null>(null);
  const [systemMaterials] = useState(() => new SystemMaterialCache());

  const model = useMemo(() => buildUniverseModel(manifest), [manifest]);
  const preset = QUALITY_PRESETS[tier];
  const bloom = preset.bloom !== null;
  const focusKey = focusKeyForTarget(target);
  // The tier's DPR is the Canvas prop itself: R3F re-applies this prop on
  // every render, so anything else (AdaptiveDpr) was reset (P-02).
  const dpr = sceneDpr(deviceDpr, preset);
  const prewarmEntries = useMemo(
    () => buildPrewarmEntries(model, preset, systemMaterials),
    [model, preset, systemMaterials],
  );
  const glFactory = useCallback<RendererFactory>(
    (defaults) => createSceneRenderer(defaults, onUnavailable),
    [onUnavailable],
  );

  useEffect(() => () => systemMaterials.dispose(), [systemMaterials]);
  useEffect(() => systemMaterials.retain(preset.lowQualityShaders), [preset, systemMaterials]);
  useEffect(() => useSceneStore.getState().setQuality(tier), [tier]);

  const advance = useCallback((next: BootStage) => {
    requestAnimationFrame(() => {
      startTransition(() => setStage((current) => (next > current ? next : current)));
    });
  }, []);
  const bloomRef = useRef(bloom);
  useEffect(() => {
    bloomRef.current = bloom;
  }, [bloom]);
  const handleFirstFrame = useCallback(() => {
    advance(bloomRef.current ? 1 : 2);
    deadlineTimer.current = window.setTimeout(() => {
      deadlineTimer.current = null;
      setDeadlinePassed(true);
      setStage(3);
    }, REVEAL_DEADLINE_MS);
  }, [advance]);
  const handleEffectsReady = useCallback(() => advance(2), [advance]);
  const handleRevealed = useCallback(() => {
    setRevealed(true);
    advance(3);
  }, [advance]);
  const handleDecline = useCallback(() => setTier((current) => stepQuality(current, -1)), []);

  useEffect(
    () => () => {
      if (deadlineTimer.current !== null) window.clearTimeout(deadlineTimer.current);
    },
    [],
  );
  // On screen: compiled through the queue, or forced by the deadline.
  const shown = revealed || deadlinePassed;

  const navigate = useCallback((to: string) => router.push(to), [router]);
  // Hidden tab: stop. Reduced motion: the scene is static between interactions.
  const frameloop = !visible ? 'never' : reducedMotion ? 'demand' : 'always';

  return (
    <Canvas
      dpr={dpr}
      gl={glFactory}
      camera={CAMERA_PROPS}
      flat
      frameloop={frameloop}
      onCreated={handleCreated}
      style={{
        opacity: shown ? 1 : 0,
        transition: `opacity ${reducedMotion ? MOTION.reducedCutMs : MOTION.fadeInMs}ms ease-out`,
      }}
    >
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
      <DemandDriver busRef={busRef} active={frameloop === 'demand'} booting={!shown} path={path} />
      <CompileService apiRef={compileRef} linearTarget={bloom} />
      <Backdrop preset={preset} />
      <Starfield preset={preset} reducedMotion={reducedMotion} />
      <CameraDirector
        target={target}
        path={path}
        model={model}
        reducedMotion={reducedMotion}
        finePointer={finePointer}
        revealed={shown}
        busRef={busRef}
      />
      {stage >= 1 && bloom ? (
        <Suspense fallback={null}>
          <Effects preset={preset} busRef={busRef} onReady={handleEffectsReady} />
        </Suspense>
      ) : null}
      {stage >= 2 ? (
        <Reveal compileRef={compileRef} force={deadlinePassed} onRevealed={handleRevealed}>
          <Universe
            model={model}
            focusKey={focusKey}
            preset={preset}
            reducedMotion={reducedMotion}
            onNavigate={navigate}
            busRef={busRef}
            prewarm={prewarmRef}
            compile={compileRef}
            systemMaterials={systemMaterials}
          />
        </Reveal>
      ) : null}
      {stage >= 3 ? (
        <>
          <QualityManager
            tier={tier}
            active={frameloop === 'always' && pinnedQuality === null}
            onDecline={handleDecline}
          />
          <Prewarm
            entries={prewarmEntries}
            generation={`${preset.lowQualityShaders}|${bloom}`}
            apiRef={prewarmRef}
            compileRef={compileRef}
          />
        </>
      ) : null}
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

/**
 * frameloop="demand" support: renders on store changes (highlight, safe rect,
 * quality), on route changes, and while any animation asked to stay alive
 * (`keepAlive`: easing, the reduced-motion cut, input). CameraControls
 * invalidates on its own while it moves.
 */
function DemandDriver({
  busRef,
  active,
  booting,
  path,
}: {
  busRef: SceneBusRef;
  active: boolean;
  /** The staged boot needs frames to advance, even under demand. */
  booting: boolean;
  path: string;
}) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!active) return;
    keepAlive(busRef.current, 500);
    invalidate();
  }, [active, path, busRef, invalidate]);

  useEffect(() => {
    if (!active) return;
    return useSceneStore.subscribe((state, previous) => {
      if (
        state.highlighted !== previous.highlighted ||
        state.safeRect !== previous.safeRect ||
        state.quality !== previous.quality
      ) {
        keepAlive(busRef.current, 600);
        invalidate();
      }
    });
  }, [active, busRef, invalidate]);

  useFrame((state) => {
    if (active && (booting || performance.now() < busRef.current.busyUntil)) state.invalidate();
  });
  return null;
}
