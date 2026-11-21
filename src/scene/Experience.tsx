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
import { sceneStateToPath, type SceneTarget } from '@/lib/route-state';
import { useSceneStore, type QualityTier } from '@/store/scene';
import {
  ARCHIVE_READY_KEY,
  createSceneBus,
  keepAlive,
  systemReadyKey,
  type SceneBusRef,
} from './bus';
import { CameraDirector } from './camera/CameraDirector';
import { GyroParallax } from './camera/GyroParallax';
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
import { ArchiveMaterialCache } from './portfolio/archive-materials';
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
import { IdleTour } from './tour/IdleTour';
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
/** Canvas fade-in when the intro flight plays right behind it (the flight is the reveal). */
const INTRO_FADE_MS = 600;

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
  const [archiveMaterials] = useState(() => new ArchiveMaterialCache());

  const model = useMemo(() => buildUniverseModel(manifest), [manifest]);
  // Idle tour order: the categories, in content order.
  const tourIds = useMemo(() => model.categories.map((category) => category.key), [model]);
  // The intro plays behind a shorter fade-in (it starts at once and is the reveal itself).
  const introPlanned = useSceneStore(
    (state) => state.introEligible === true && !state.introSkip && target.mode === 'universe',
  );
  const preset = QUALITY_PRESETS[tier];
  const bloom = preset.bloom !== null;
  const focusKey = focusKeyForTarget(target);
  const focusedPlanet = useMemo(
    () =>
      target.mode === 'planet' ? { category: target.category, service: target.service } : null,
    [target],
  );
  const focusedProject = target.mode === 'project' ? target.project : null;
  // The tier's DPR is the Canvas prop itself: R3F re-applies this prop on
  // every render, so anything else (AdaptiveDpr) was reset (P-02).
  const dpr = sceneDpr(deviceDpr, preset);
  const prewarmEntries = useMemo(
    () => buildPrewarmEntries(model, preset, systemMaterials, archiveMaterials),
    [model, preset, systemMaterials, archiveMaterials],
  );
  const glFactory = useCallback<RendererFactory>(
    (defaults) => createSceneRenderer(defaults, onUnavailable),
    [onUnavailable],
  );

  useEffect(() => () => systemMaterials.dispose(), [systemMaterials]);
  useEffect(() => systemMaterials.retain(preset.lowQualityShaders), [preset, systemMaterials]);
  useEffect(() => () => archiveMaterials.dispose(), [archiveMaterials]);
  useEffect(() => archiveMaterials.retain(preset.lowQualityShaders), [preset, archiveMaterials]);
  useEffect(() => useSceneStore.getState().setQuality(tier), [tier]);
  // Boot progress (D94): the chunk is loaded once this component runs.
  useEffect(() => useSceneStore.getState().setBootProgress(0.25), []);
  // Leaving the 3D layer (simple mode, D94): nothing of the scene stays in the store.
  useEffect(
    () => () => {
      const store = useSceneStore.getState();
      store.setFocus(null);
      store.setFlight({ active: false, progress: 1, to: null });
      if (store.introActive) store.setIntroActive(false);
    },
    [],
  );

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
    useSceneStore.getState().setBootProgress(0.5);
    advance(bloomRef.current ? 1 : 2);
    deadlineTimer.current = window.setTimeout(() => {
      deadlineTimer.current = null;
      setDeadlinePassed(true);
      setStage(3);
    }, REVEAL_DEADLINE_MS);
  }, [advance]);
  const handleEffectsReady = useCallback(() => advance(2), [advance]);
  const handleRevealed = useCallback(() => {
    useSceneStore.getState().setBootProgress(0.85);
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
  useEffect(() => {
    if (shown) useSceneStore.getState().setBootProgress(1);
  }, [shown]);

  const navigate = useCallback(
    (to: string, replace = false) => (replace ? router.replace(to) : router.push(to)),
    [router],
  );
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
        transition: `opacity ${
          reducedMotion ? MOTION.reducedCutMs : introPlanned ? INTRO_FADE_MS : MOTION.fadeInMs
        }ms ease-out`,
      }}
    >
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
      <SceneReadySignal busRef={busRef} target={target} path={path} shown={shown} />
      <IdleTour
        ids={tourIds}
        shown={shown}
        home={target.mode === 'universe'}
        reducedMotion={reducedMotion}
      />
      <GyroParallax busRef={busRef} enabled={visible && !reducedMotion} />
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
            focusedPlanet={focusedPlanet}
            focusedProject={focusedProject}
            preset={preset}
            reducedMotion={reducedMotion}
            onNavigate={navigate}
            busRef={busRef}
            prewarm={prewarmRef}
            compile={compileRef}
            systemMaterials={systemMaterials}
            archiveMaterials={archiveMaterials}
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

/** `bus.readyContent` key the URL's focused content must reach, or null (universe). */
function readyKeyFor(target: SceneTarget): string | null {
  switch (target.mode) {
    case 'system':
    case 'planet':
      return systemReadyKey(target.category);
    case 'portfolio':
    case 'project':
      return ARCHIVE_READY_KEY;
    default:
      return null;
  }
}

/**
 * `html[data-scene-ready="<path>"]` for automation (screenshots wait for it):
 * set on every scene route (home, systems, planets, portfolio — also with no
 * projects —, projects, configurator) while the camera has settled on the
 * URL's state and its focused content (system, archive) is compiled and on
 * screen; removed otherwise, and never set on unknown routes.
 */
function SceneReadySignal({
  busRef,
  target,
  path,
  shown,
}: {
  busRef: SceneBusRef;
  target: SceneTarget;
  path: string;
  shown: boolean;
}) {
  const last = useRef<string | null>(null);
  useEffect(
    () => () => {
      delete document.documentElement.dataset.sceneReady;
    },
    [],
  );
  useFrame(() => {
    const bus = busRef.current;
    // Unknown routes (404) need no readiness signal.
    const required = target.mode === 'unknown' ? undefined : readyKeyFor(target);
    const store = useSceneStore.getState();
    const settled = shown && !bus.flying && !store.introActive && store.focus === path;
    const contentReady =
      required !== undefined && (required === null || bus.readyContent.has(required));
    const value = settled && contentReady ? path : null;
    if (value === last.current) return;
    last.current = value;
    if (value) document.documentElement.dataset.sceneReady = value;
    else delete document.documentElement.dataset.sceneReady;
  });
  return null;
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
