'use client';

import { useEffect, useRef, useState } from 'react';
import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap/gsap-core';
import { Spherical, Vector3, type PerspectiveCamera } from 'three';
import type { SceneTarget } from '@/lib/route-state';
import { useSceneStore, type SafeRect } from '@/store/scene';
import { keepAlive, type SceneBus, type SceneBusRef } from '../bus';
import { debugSlowMotion } from '../debug/scene-stats';
import { CAMERA, MOTION } from '../config';
import { focusKeyForTarget } from '../node-ids';
import { isPerspectiveCamera } from '../three-utils';
import type { UniverseModel } from '../universe/model';
import { dampFactor, smoothDamp, type ScalarDampState } from './damp';
import {
  FLIGHT_PROFILES,
  classifyFlight,
  flightDuration,
  flightHop,
  flightTimeline,
  idleSway,
  interpolatePose,
  isOverview,
  poseFromLookAt,
  poseToPosition,
  quantizeProgress,
  shortestAngleDelta,
  type FlightKind,
  type OrbitPose,
} from './flight';
import {
  FULL_FRAME,
  computeCameraGoal,
  controlLimits,
  frameCenter,
  minCoreDiameterPx,
  resolveSafeFrame,
  viewOffsetForCenter,
  type CameraGoal,
  type SafeFrame,
} from './goals';

type Timeline = ReturnType<typeof gsap.timeline>;

const { ACTION } = CameraControlsImpl;
/** Rotate with the primary button / one finger, dolly with wheel / pinch; no panning. */
const MOUSE_BUTTONS = {
  left: ACTION.ROTATE,
  middle: ACTION.DOLLY,
  right: ACTION.NONE,
  wheel: ACTION.DOLLY,
} as const;
const TOUCHES = { one: ACTION.TOUCH_ROTATE, two: ACTION.TOUCH_DOLLY, three: ACTION.NONE } as const;

/** Opening shot: the camera settles in from slightly farther while the canvas fades in. */
const INTRO = { pullback: 1.32, azimuth: 0.12, polar: -0.05, duration: 2.6 } as const;
/** Safe-rect changes this early in the intro re-base it instead of sliding (D28). */
const INTRO_SNAP_SECONDS = 0.5;
/** Frame changes below this (viewport fractions) are ignored. */
const FRAME_EPSILON = 1e-4;
/** Idle auto-rotate: delay after the last input, sway / spin per focus. */
const IDLE = {
  delayMs: 6000,
  rampIn: 4,
  /** ±11.5°: the overview fit covers it (computeCameraGoal `sway`, visual V2-08). */
  overview: { amplitude: 0.2, period: 70 },
  anchor: { amplitude: 0.2, period: 60 },
  /** Systems are round: a slow continuous spin (rad/s). */
  systemSpin: 0.028,
} as const;
/** Inertia: share of the release velocity carried on after a drag (seconds of travel). */
const FLING_SECONDS = 0.32;
/** FOV punch share on portrait screens. */
const PORTRAIT_PUNCH_SHARE = 0.6;
/** After an interrupt, the elevation is eased back within this range of the goal's (rad). */
const INTERRUPT_POLAR_RANGE = 0.35;
/** Pointer parallax (fine pointers), share of the view distance. */
const PARALLAX = { x: 0.016, y: 0.01 } as const;

interface CameraDirectorProps {
  target: SceneTarget;
  /** Locale-less path of `target` (published as `flight.to`). */
  path: string;
  model: UniverseModel;
  reducedMotion: boolean;
  /** Mouse/trackpad primary pointer: enables subtle pointer parallax. */
  finePointer: boolean;
  /** The universe is compiled and visible: interaction and the intro may start. */
  revealed: boolean;
  busRef: SceneBusRef;
}

interface Channels {
  look: number;
  dolly: number;
  orbit: number;
  arc: number;
  punch: number;
  flash: number;
}

interface Flight {
  kind: FlightKind | 'intro';
  timeline: Timeline;
  channels: Channels;
  from: OrbitPose;
  fromFov: number;
  fromCenter: { x: number; y: number };
  hop: number;
  duration: number;
  punchDeg: number;
  elapsed: number;
  /** Published as `flight.to`; null for the intro (not a navigation). */
  path: string | null;
  focusFrom: string | null;
  focusTo: string | null;
}

interface Cut {
  elapsed: number;
  path: string;
  switched: boolean;
  focusFrom: string | null;
  focusTo: string | null;
}

interface DirectorState {
  initialized: boolean;
  age: number;
  target: SceneTarget;
  targetPath: string;
  goal: CameraGoal | null;
  goalPose: OrbitPose;
  goalModel: UniverseModel | null;
  goalAspect: number;
  /** Planet angle the cached goal was computed for (planet routes). */
  goalPlanetAngle: number | undefined;
  /** Configurator selection the goal was fitted to (store `emphasis`, D81). */
  goalEmphasis: readonly string[] | undefined;
  /** Visitor's azimuth deviation carried into focused views (approach from their side). */
  azimuthOffset: number;
  /** Goal distance the current limits and zoom ratio refer to. */
  settledRadius: number;
  safeRect: SafeRect | null | undefined;
  viewportWidth: number;
  viewportHeight: number;
  canvasLeft: number;
  canvasTop: number;
  frame: SafeFrame;
  fov: ScalarDampState;
  centerX: ScalarDampState;
  centerY: ScalarDampState;
  flight: Flight | null;
  flashTail: { timeline: Timeline; channels: Channels; elapsed: number } | null;
  cut: Cut | null;
  /** The universe is visible (staged boot). */
  revealed: boolean;
  inputPending: boolean;
  /** Wheel input keeps its own zoom when it interrupts a flight; a drag lets the dive finish. */
  inputWheel: boolean;
  dragging: boolean;
  dragVelocity: { azimuth: number; polar: number };
  dragPrev: { azimuth: number; polar: number } | null;
  idleClock: number;
  swayApplied: number;
  /** `performance.now()` when the last flight settled (idle motion waits after it too). */
  settledAt: number;
  /** Focal offset last sent to the controls (pointer parallax). */
  parallaxX: number;
  parallaxY: number;
  refreshHover: boolean;
}

/**
 * Camera director. drei `CameraControls` owns user input (rotate with
 * inertia, dolly limited around the current framing, one-finger rotate and
 * pinch on touch, no pan) and writes the camera every frame; this component
 * decides where the controls should be:
 *
 * - The URL target (`computeCameraGoal`, pure) is fitted into the free part
 *   of the viewport (`safeRect`, D28) and the principal point moved to its
 *   centre with `camera.setViewOffset` — CameraControls' own fit ignores the
 *   view offset, so it is not used.
 * - A new target starts a GSAP-timeline flight (D-ease per channel, 1.2–2 s,
 *   FOV punch, bloom flash when arriving in a system) whose channels drive
 *   the controls pose each frame. User input interrupts it: the remaining
 *   pivot/distance change is handed to the controls' damping, so the visitor
 *   keeps control and still ends up at the destination.
 * - Under prefers-reduced-motion the camera cuts behind a 300 ms canvas dip.
 * - Flight state goes to the store (`flight`) for the UI (hero reveal).
 * - Idle auto-rotate after a few seconds without input, paused on hover.
 */
export function CameraDirector({
  target,
  path,
  model,
  reducedMotion,
  finePointer,
  revealed,
  busRef,
}: CameraDirectorProps) {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const stateRef = useRef<DirectorState | null>(null);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const connected = useThree((state) => state.events.connected) as unknown;
  // `?debug=1&slowmo=N`: slower flights for frame-series captures (read once).
  const [slowMotion] = useState(() => debugSlowMotion(window.location.search));

  // Leave the shared camera clean and the store idle when the director goes away.
  useEffect(
    () => () => {
      if (isPerspectiveCamera(camera)) camera.clearViewOffset();
      const director = stateRef.current;
      director?.flight?.timeline.kill();
      director?.flashTail?.timeline.kill();
      publishFlight(false, 1, null);
      useSceneStore.getState().setFocus(null);
    },
    [camera],
  );

  // Input on the canvas: interrupts flights, resets the idle clock.
  useEffect(() => {
    const element = connected instanceof HTMLElement ? connected : gl.domElement;
    const mark = () => {
      const shared = busRef.current;
      shared.lastInputAt = performance.now();
      keepAlive(shared, 1500);
    };
    const signal = (wheel: boolean) => {
      mark();
      const director = stateRef.current;
      if (!director) return;
      director.inputPending = true;
      director.inputWheel = wheel;
    };
    const onPointerDown = () => signal(false);
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons !== 0) mark();
    };
    const onWheel = () => signal(true);
    element.addEventListener('pointerdown', onPointerDown, { capture: true });
    element.addEventListener('pointermove', onPointerMove, { passive: true });
    element.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      element.removeEventListener('pointerdown', onPointerDown, { capture: true });
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('wheel', onWheel);
    };
  }, [connected, gl, busRef]);

  // Drag state from CameraControls (for inertia and the idle clock).
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => {
      const director = stateRef.current;
      if (!director) return;
      director.dragging = true;
      director.dragPrev = null;
      director.dragVelocity = { azimuth: 0, polar: 0 };
    };
    const onEnd = () => {
      const director = stateRef.current;
      if (!director) return;
      director.dragging = false;
      if (reducedMotion || director.flight || director.cut) return;
      const { azimuth, polar } = director.dragVelocity;
      // Inertia: keep turning in the release direction and ease out (controls' smoothTime).
      if (Math.abs(azimuth) + Math.abs(polar) > 0.05) {
        void controls.rotate(azimuth * FLING_SECONDS, polar * FLING_SECONDS, true);
      }
    };
    controls.addEventListener('controlstart', onStart);
    controls.addEventListener('controlend', onEnd);
    return () => {
      controls.removeEventListener('controlstart', onStart);
      controls.removeEventListener('controlend', onEnd);
    };
  }, [reducedMotion]);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    const cam = state.camera;
    if (!controls || !isPerspectiveCamera(cam)) return;
    const { width, height, left, top } = state.size;
    if (!(width > 0) || !(height > 0)) return;
    const shared = busRef.current;
    const dt = Math.min(delta, 0.1);
    const motionDt = dt / slowMotion;
    const aspect = width / height;
    const d = (stateRef.current ??= createDirectorState(target, path));

    // 1. Free frame (non-reactive store read, resolved only when inputs change).
    const safeRect = useSceneStore.getState().safeRect;
    let frameChanged = false;
    if (
      safeRect !== d.safeRect ||
      width !== d.viewportWidth ||
      height !== d.viewportHeight ||
      left !== d.canvasLeft ||
      top !== d.canvasTop
    ) {
      d.safeRect = safeRect;
      d.viewportWidth = width;
      d.viewportHeight = height;
      d.canvasLeft = left;
      d.canvasTop = top;
      const local = safeRect ? { ...safeRect, x: safeRect.x - left, y: safeRect.y - top } : null;
      const next = resolveSafeFrame(local, width, height);
      frameChanged = !sameFrame(next, d.frame);
      if (frameChanged) d.frame = next;
    }
    const minCore = minCoreDiameterPx(d.frame.width * width, d.frame.height * height, finePointer);
    shared.minCorePx =
      !d.initialized || reducedMotion
        ? minCore
        : shared.minCorePx + (minCore - shared.minCorePx) * dampFactor(2.5, dt);

    // 2. New URL target: carry the visitor's rotation into focused views.
    const targetChanged = d.initialized && path !== d.targetPath;
    const previousTarget = d.target;
    if (targetChanged) {
      const moving = d.cut !== null || (d.flight !== null && d.flight.kind !== 'intro');
      if (isOverview(target)) {
        d.azimuthOffset = 0;
      } else if (!moving) {
        // Mid-flight the azimuth is an interpolation, not a choice: keep the offset.
        const deviation = shortestAngleDelta(
          d.goalPose.azimuth + d.azimuthOffset,
          controls.azimuthAngle,
        );
        d.azimuthOffset = isOverview(previousTarget) ? deviation : d.azimuthOffset + deviation;
      }
      d.target = target;
      d.targetPath = path;
    }

    // 3. Goal for the current target and frame (pure; cached). On a planet
    // route the goal follows the planet's live angle while it parks.
    const planetAngle =
      target.mode === 'planet'
        ? shared.planetAngles.get(`${target.category}/${target.service}`)
        : undefined;
    const angleChanged =
      planetAngle !== undefined &&
      (d.goalPlanetAngle === undefined || Math.abs(planetAngle - d.goalPlanetAngle) > 1e-5);
    // On the configurator the framing also keeps the selected categories in view.
    const emphasis = target.mode === 'configurator' ? useSceneStore.getState().emphasis : undefined;
    let goalChanged = false;
    if (
      d.goal === null ||
      targetChanged ||
      model !== d.goalModel ||
      aspect !== d.goalAspect ||
      frameChanged ||
      angleChanged ||
      emphasis !== d.goalEmphasis
    ) {
      d.goal = computeCameraGoal(target, model, aspect, d.frame, {
        sway: reducedMotion ? 0 : IDLE.overview.amplitude,
        planetAngle,
        emphasis,
      });
      d.goalPose = poseFromLookAt(d.goal.position, d.goal.lookAt);
      d.goalModel = model;
      d.goalAspect = aspect;
      d.goalPlanetAngle = planetAngle;
      d.goalEmphasis = emphasis;
      goalChanged = true;
    }
    const goal = d.goal;
    const goalPose: OrbitPose = { ...d.goalPose, azimuth: d.goalPose.azimuth + d.azimuthOffset };
    const center = frameCenter(d.frame);

    // 4. First frame / target change.
    if (!d.initialized) {
      d.initialized = true;
      applyPose(controls, goalPose);
      setLimits(controls, target, goalPose);
      d.settledRadius = goalPose.radius;
      d.fov = { value: goal.fov, velocity: 0 };
      snapCenter(d, center);
      shared.interactive = false;
      if (!reducedMotion) d.flight = createIntro(goalPose, goal.fov, center);
      // First rendered frame of a deep link / first load (D56).
      useSceneStore.getState().setFocus(path);
    } else if (targetChanged) {
      // Input that came before this navigation (e.g. the click that caused it) never interrupts it.
      d.inputPending = false;
      if (reducedMotion) startCut(d, shared, previousTarget, target, path);
      else startFlight(d, shared, controls, cam, previousTarget, target, path, goalPose, aspect);
    }
    // The universe became visible (staged boot): interaction may start.
    if (revealed && !d.revealed) {
      d.revealed = true;
      if (!d.cut && (!d.flight || d.flight.kind === 'intro')) {
        shared.interactive = isOverview(target);
        shared.systemInteractive = systemCategory(target);
        d.refreshHover = true;
      }
    }
    d.age += dt;

    // 5. User input interrupts programmatic motion (never the reduced-motion cut).
    if (d.inputPending) {
      d.inputPending = false;
      if (d.flight) interruptFlight(d, shared, controls, target, goalPose, d.inputWheel);
      d.idleClock = 0;
      d.swayApplied = 0;
    }

    // 6. Motion.
    if (d.cut) {
      stepCut(d, shared, controls, state.gl.domElement, motionDt, target, goalPose, goal, center);
    } else if (d.flight) {
      const flight = d.flight;
      if (flight.kind === 'intro' && frameChanged && d.age < INTRO_SNAP_SECONDS) {
        flight.from = introStart(goalPose);
        flight.fromCenter = center;
        snapCenter(d, center);
      }
      // The intro waits for the reveal (it is the canvas fade-in's camera move).
      const introWaits = flight.kind === 'intro' && !d.revealed;
      stepFlight(d, shared, controls, introWaits ? 0 : motionDt, target, goalPose, goal, center);
    } else {
      if (goalChanged) reframe(d, controls, target, goalPose, reducedMotion);
      if (reducedMotion) {
        d.fov = { value: goal.fov, velocity: 0 };
        snapCenter(d, center);
      } else {
        smoothDamp(d.fov, goal.fov, MOTION.fovSmoothTime, dt);
        smoothDamp(d.centerX, center.x, MOTION.cameraSmoothTime, dt);
        smoothDamp(d.centerY, center.y, MOTION.cameraSmoothTime, dt);
        idleMotion(d, shared, controls, target, dt);
        if (finePointer && !d.dragging) {
          const distance = controls.distance;
          parallax(
            d,
            controls,
            state.pointer.x * PARALLAX.x * distance,
            -state.pointer.y * PARALLAX.y * distance,
          );
        }
      }
    }
    if (d.flashTail) {
      const tail = d.flashTail;
      tail.elapsed += motionDt;
      tail.timeline.time(Math.min(tail.elapsed, tail.timeline.duration()));
      shared.flash = tail.channels.flash;
      if (tail.elapsed >= tail.timeline.duration()) {
        tail.timeline.kill();
        d.flashTail = null;
        shared.flash = 0;
      }
    }
    trackDrag(d, controls, dt);

    // 7. Projection: FOV, adaptive near plane, principal point in the free frame.
    applyProjection(cam, controls.distance, d, width, height);
  }, -2);

  // After CameraControls moved the camera: re-raycast a still pointer (QA N3a).
  useFrame((state) => {
    const d = stateRef.current;
    if (!d?.refreshHover) return;
    d.refreshHover = false;
    state.camera.updateMatrixWorld();
    state.events.update?.();
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.5}
      draggingSmoothTime={0.16}
      azimuthRotateSpeed={0.4}
      polarRotateSpeed={0.3}
      dollySpeed={0.55}
      truckSpeed={0}
      dollyToCursor={false}
      mouseButtons={MOUSE_BUTTONS}
      touches={TOUCHES}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Flights                                                             */
/* ------------------------------------------------------------------ */

function startFlight(
  d: DirectorState,
  shared: SceneBus,
  controls: CameraControlsImpl,
  cam: PerspectiveCamera,
  from: SceneTarget,
  to: SceneTarget,
  path: string,
  goalPose: OrbitPose,
  aspect: number,
) {
  d.flight?.timeline.kill();
  d.cut = null;
  const kind = classifyFlight(from, to);
  const profile = FLIGHT_PROFILES[kind];
  // Portrait screens stretch the frame edges more under a wide FOV (visual N2-03).
  const punchDeg = profile.punchDeg * (aspect < 1 ? PORTRAIT_PUNCH_SHARE : 1);
  const start = readPose(controls);
  const duration = flightDuration(start, goalPose, kind);
  const hop = kind === 'local' ? 0 : flightHop(start, goalPose);
  const channels: Channels = { look: 0, dolly: 0, orbit: 0, arc: 0, punch: 0, flash: 0 };
  const w = flightTimeline(kind, duration);
  const timeline = gsap.timeline({ paused: true });
  timeline
    .to(channels, { look: 1, duration: w.look.duration, ease: w.look.ease }, w.look.start)
    .to(channels, { dolly: 1, duration: w.dolly.duration, ease: w.dolly.ease }, w.dolly.start)
    .to(channels, { orbit: 1, duration: w.orbit.duration, ease: w.orbit.ease }, w.orbit.start);
  if (hop > 0) {
    timeline
      .to(channels, { arc: 1, duration: w.arcUp.duration, ease: w.arcUp.ease }, w.arcUp.start)
      .to(
        channels,
        { arc: 0, duration: w.arcDown.duration, ease: w.arcDown.ease },
        w.arcDown.start,
      );
  }
  if (punchDeg > 0) {
    timeline
      .to(
        channels,
        { punch: 1, duration: w.punchUp.duration, ease: w.punchUp.ease },
        w.punchUp.start,
      )
      .to(
        channels,
        { punch: 0, duration: w.punchDown.duration, ease: w.punchDown.ease },
        w.punchDown.start,
      );
  }
  const arrivesInSystem = to.mode === 'system' || to.mode === 'planet';
  const flash = arrivesInSystem ? profile.flash : 0;
  if (flash > 0) {
    timeline
      .to(channels, { flash, duration: w.flashUp.duration, ease: w.flashUp.ease }, w.flashUp.start)
      .to(
        channels,
        { flash: 0, duration: w.flashDown.duration, ease: w.flashDown.ease },
        w.flashDown.start,
      );
  }
  // Make sure the timeline spans the whole camera move even without optional channels.
  timeline.set(channels, {}, duration);
  d.flight = {
    kind,
    timeline,
    channels,
    from: start,
    fromFov: cam.fov,
    fromCenter: { x: d.centerX.value, y: d.centerY.value },
    hop,
    duration,
    punchDeg,
    elapsed: 0,
    path,
    focusFrom: focusKeyForTarget(from),
    focusTo: focusKeyForTarget(to),
  };
  d.flashTail?.timeline.kill();
  d.flashTail = null;
  void controls.setFocalOffset(0, 0, 0, true);
  d.parallaxX = 0;
  d.parallaxY = 0;
  shared.flying = true;
  shared.interactive = false;
  shared.systemInteractive = null;
  shared.focusDriven = true;
  shared.focusFrom = d.flight.focusFrom;
  shared.focusTo = d.flight.focusTo;
  shared.focusFromAmount = 1;
  shared.focusToAmount = 0;
  publishFlight(true, 0, path);
}

function createIntro(goalPose: OrbitPose, fov: number, center: { x: number; y: number }): Flight {
  const channels: Channels = { look: 0, dolly: 0, orbit: 0, arc: 0, punch: 0, flash: 0 };
  const timeline = gsap.timeline({ paused: true });
  timeline.to(
    channels,
    { look: 1, dolly: 1, orbit: 1, duration: INTRO.duration, ease: 'power2.out' },
    0,
  );
  return {
    kind: 'intro',
    timeline,
    channels,
    from: introStart(goalPose),
    fromFov: fov,
    fromCenter: center,
    hop: 0,
    duration: INTRO.duration,
    punchDeg: 0,
    elapsed: 0,
    path: null,
    focusFrom: null,
    focusTo: null,
  };
}

function introStart(goalPose: OrbitPose): OrbitPose {
  return {
    target: [...goalPose.target],
    radius: goalPose.radius * INTRO.pullback,
    azimuth: goalPose.azimuth + INTRO.azimuth,
    polar: goalPose.polar + INTRO.polar,
  };
}

function stepFlight(
  d: DirectorState,
  shared: SceneBus,
  controls: CameraControlsImpl,
  dt: number,
  target: SceneTarget,
  goalPose: OrbitPose,
  goal: CameraGoal,
  center: { x: number; y: number },
) {
  const flight = d.flight!;
  flight.elapsed += dt;
  flight.timeline.time(Math.min(flight.elapsed, flight.timeline.duration()));
  const ch = flight.channels;
  applyPose(controls, interpolatePose(flight.from, goalPose, ch, flight.hop));
  d.fov.value = lerp(flight.fromFov, goal.fov, ch.look) + flight.punchDeg * ch.punch;
  d.fov.velocity = 0;
  d.centerX.value = lerp(flight.fromCenter.x, center.x, ch.look);
  d.centerY.value = lerp(flight.fromCenter.y, center.y, ch.look);
  d.centerX.velocity = 0;
  d.centerY.velocity = 0;
  shared.flash = ch.flash;
  if (flight.kind !== 'intro') {
    shared.focusFromAmount = 1 - ch.dolly;
    shared.focusToAmount = ch.dolly;
    publishFlight(true, flight.elapsed / flight.duration, flight.path);
  }
  if (flight.elapsed >= flight.duration)
    settle(d, shared, controls, target, goalPose, goal, center);
}

/** The camera reached the goal: hand over to the controls (limits, idle motion, hover). */
function settle(
  d: DirectorState,
  shared: SceneBus,
  controls: CameraControlsImpl,
  target: SceneTarget,
  goalPose: OrbitPose,
  goal: CameraGoal,
  center: { x: number; y: number },
) {
  const flight = d.flight;
  if (flight && flight.timeline.duration() > flight.elapsed + 1e-3) {
    // The bloom flash decays after arrival.
    d.flashTail = { timeline: flight.timeline, channels: flight.channels, elapsed: flight.elapsed };
  } else {
    flight?.timeline.kill();
  }
  d.flight = null;
  applyPose(controls, goalPose);
  setLimits(controls, target, goalPose);
  d.settledRadius = goalPose.radius;
  d.fov = { value: goal.fov, velocity: 0 };
  snapCenter(d, center);
  finishMotion(d, shared, target);
}

function interruptFlight(
  d: DirectorState,
  shared: SceneBus,
  controls: CameraControlsImpl,
  target: SceneTarget,
  goalPose: OrbitPose,
  keepZoom: boolean,
) {
  const flight = d.flight!;
  d.flight = null;
  if (flight.timeline.duration() > flight.elapsed + 1e-3 && flight.channels.flash > 0) {
    d.flashTail = { timeline: flight.timeline, channels: flight.channels, elapsed: flight.elapsed };
  } else {
    flight.timeline.kill();
  }
  setLimits(controls, target, goalPose);
  d.settledRadius = goalPose.radius;
  // Hand the rest of the move to the controls' damping; the visitor keeps rotating meanwhile.
  void controls.setTarget(goalPose.target[0], goalPose.target[1], goalPose.target[2], true);
  const radius = keepZoom ? controls.getSpherical(scratchSpherical, true).radius : goalPose.radius;
  void controls.dollyTo(radius, true);
  // Mid-flight the elevation can be far from the goal's (near edge-on views): ease it back in range.
  const polar = controls.polarAngle;
  const clamped = Math.min(
    Math.max(polar, goalPose.polar - INTERRUPT_POLAR_RANGE),
    goalPose.polar + INTERRUPT_POLAR_RANGE,
  );
  if (clamped !== polar) void controls.rotatePolarTo(clamped, true);
  finishMotion(d, shared, target);
}

function finishMotion(d: DirectorState, shared: SceneBus, target: SceneTarget) {
  shared.flying = false;
  shared.focusDriven = false;
  shared.interactive = isOverview(target) && d.revealed;
  shared.systemInteractive = d.revealed ? systemCategory(target) : null;
  // The camera settled on the URL's state (D56).
  useSceneStore.getState().setFocus(d.targetPath);
  d.idleClock = 0;
  d.swayApplied = 0;
  d.settledAt = performance.now();
  d.refreshHover = true;
  publishFlight(false, 1, null);
}

/* ------------------------------------------------------------------ */
/* Reduced motion: a 300 ms dip of the canvas with a cut in the middle */
/* ------------------------------------------------------------------ */

function startCut(
  d: DirectorState,
  shared: SceneBus,
  from: SceneTarget,
  to: SceneTarget,
  path: string,
) {
  d.flight?.timeline.kill();
  d.flight = null;
  d.cut = {
    elapsed: 0,
    path,
    switched: false,
    focusFrom: focusKeyForTarget(from),
    focusTo: focusKeyForTarget(to),
  };
  shared.flying = true;
  shared.interactive = false;
  shared.systemInteractive = null;
  shared.focusDriven = true;
  shared.focusFrom = d.cut.focusFrom;
  shared.focusTo = d.cut.focusTo;
  shared.focusFromAmount = 1;
  shared.focusToAmount = 0;
  keepAlive(shared, MOTION.reducedCutMs + 200);
  publishFlight(true, 0, path);
}

function stepCut(
  d: DirectorState,
  shared: SceneBus,
  controls: CameraControlsImpl,
  canvas: HTMLCanvasElement,
  dt: number,
  target: SceneTarget,
  goalPose: OrbitPose,
  goal: CameraGoal,
  center: { x: number; y: number },
) {
  const cut = d.cut!;
  cut.elapsed += dt * 1000;
  const half = MOTION.reducedCutMs / 2;
  const t = cut.elapsed < half ? cut.elapsed / half : 2 - cut.elapsed / half;
  canvas.style.opacity = String(1 - Math.min(Math.max(t, 0), 1));
  if (!cut.switched && cut.elapsed >= half) {
    cut.switched = true;
    applyPose(controls, goalPose);
    d.fov = { value: goal.fov, velocity: 0 };
    snapCenter(d, center);
    shared.focusFromAmount = 0;
    shared.focusToAmount = 1;
  }
  keepAlive(shared, 100);
  publishFlight(true, cut.elapsed / MOTION.reducedCutMs, cut.path);
  if (cut.elapsed >= MOTION.reducedCutMs) {
    canvas.style.opacity = '';
    d.cut = null;
    applyPose(controls, goalPose);
    setLimits(controls, target, goalPose);
    d.settledRadius = goalPose.radius;
    finishMotion(d, shared, target);
  }
}

/* ------------------------------------------------------------------ */
/* Settled behaviour                                                   */
/* ------------------------------------------------------------------ */

/** The frame or viewport changed while settled: refit, keeping the visitor's rotation and zoom. */
function reframe(
  d: DirectorState,
  controls: CameraControlsImpl,
  target: SceneTarget,
  goalPose: OrbitPose,
  reducedMotion: boolean,
) {
  const endRadius = controls.getSpherical(scratchSpherical, true).radius;
  const zoom = Math.min(Math.max(endRadius / Math.max(d.settledRadius, 1e-3), 0.3), 3);
  setLimits(controls, target, goalPose);
  d.settledRadius = goalPose.radius;
  const animate = !reducedMotion;
  void controls.setTarget(goalPose.target[0], goalPose.target[1], goalPose.target[2], animate);
  void controls.dollyTo(goalPose.radius * zoom, animate);
}

function idleMotion(
  d: DirectorState,
  shared: SceneBus,
  controls: CameraControlsImpl,
  target: SceneTarget,
  dt: number,
) {
  const lastActivity = Math.max(shared.lastInputAt, d.settledAt);
  const idle = performance.now() - lastActivity > IDLE.delayMs && !d.dragging;
  if (!idle) {
    d.idleClock = 0;
    d.swayApplied = 0;
    return;
  }
  // Hover (3D or HTML highlight) pauses the motion without resetting its phase.
  if (shared.hovering) return;
  d.idleClock += dt;
  if (target.mode === 'system' || target.mode === 'planet') {
    const ramp = Math.min(d.idleClock / IDLE.rampIn, 1);
    void controls.rotate(IDLE.systemSpin * ramp * ramp * dt, 0, false);
    return;
  }
  const { amplitude, period } = isOverview(target) ? IDLE.overview : IDLE.anchor;
  const sway = idleSway(d.idleClock, amplitude, period, IDLE.rampIn);
  void controls.rotate(sway - d.swayApplied, 0, false);
  d.swayApplied = sway;
}

/**
 * Pointer parallax through the controls' focal offset (eased by their
 * smoothTime). Sent only when it moved noticeably: every call wakes the
 * controls, and drei invalidates the frame on each update.
 */
function parallax(d: DirectorState, controls: CameraControlsImpl, x: number, y: number) {
  const epsilon = 0.002 * Math.max(controls.distance, 1);
  if (Math.abs(x - d.parallaxX) < epsilon && Math.abs(y - d.parallaxY) < epsilon) return;
  d.parallaxX = x;
  d.parallaxY = y;
  void controls.setFocalOffset(x, y, 0, true);
}

/** Release velocity of a drag, for the inertia fling. */
function trackDrag(d: DirectorState, controls: CameraControlsImpl, dt: number) {
  if (!d.dragging || dt <= 0) return;
  const end = controls.getSpherical(scratchSpherical, true);
  if (d.dragPrev) {
    const k = dampFactor(18, dt);
    const va = shortestAngleDelta(d.dragPrev.azimuth, end.theta) / dt;
    const vp = (end.phi - d.dragPrev.polar) / dt;
    d.dragVelocity.azimuth += (va - d.dragVelocity.azimuth) * k;
    d.dragVelocity.polar += (vp - d.dragVelocity.polar) * k;
  }
  d.dragPrev = { azimuth: end.theta, polar: end.phi };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const scratchSpherical = new Spherical();
const scratchTarget = new Vector3();

function readPose(controls: CameraControlsImpl): OrbitPose {
  controls.getTarget(scratchTarget, false);
  return {
    target: [scratchTarget.x, scratchTarget.y, scratchTarget.z],
    radius: controls.distance,
    azimuth: controls.azimuthAngle,
    polar: controls.polarAngle,
  };
}

function applyPose(controls: CameraControlsImpl, pose: OrbitPose) {
  const [px, py, pz] = poseToPosition(pose);
  const [tx, ty, tz] = pose.target;
  void controls.setLookAt(px, py, pz, tx, ty, tz, false);
}

function setLimits(controls: CameraControlsImpl, target: SceneTarget, pose: OrbitPose) {
  const limits = controlLimits(target, pose.radius, pose.polar);
  controls.minDistance = limits.minDistance;
  controls.maxDistance = limits.maxDistance;
  controls.minPolarAngle = limits.minPolar;
  controls.maxPolarAngle = limits.maxPolar;
}

function applyProjection(
  cam: PerspectiveCamera,
  viewDistance: number,
  d: DirectorState,
  width: number,
  height: number,
) {
  // Adaptive near plane: precision follows the view distance (universe ↔ nested system).
  const near = Math.min(Math.max(viewDistance * CAMERA.nearFactor, CAMERA.minNear), CAMERA.maxNear);
  const offset = viewOffsetForCenter(d.centerX.value, d.centerY.value, width, height);
  const view = cam.view;
  const viewChanged =
    view === null ||
    !view.enabled ||
    view.fullWidth !== width ||
    view.fullHeight !== height ||
    Math.abs(view.offsetX - offset.x) > 0.01 ||
    Math.abs(view.offsetY - offset.y) > 0.01;
  const nearChanged = Math.abs(near - cam.near) / cam.near > 0.08;
  const fovChanged = Math.abs(d.fov.value - cam.fov) > 0.01;
  if (viewChanged || nearChanged || fovChanged || cam.far !== CAMERA.far) {
    cam.near = near;
    cam.far = CAMERA.far;
    cam.fov = d.fov.value;
    // Full-size window shifted by the offset; also sets the aspect and updates the projection.
    cam.setViewOffset(width, height, offset.x, offset.y, width, height);
  }
}

function publishFlight(active: boolean, progress: number, to: string | null) {
  const store = useSceneStore.getState();
  const value = quantizeProgress(progress);
  const current = store.flight;
  if (current.active === active && current.progress === value && current.to === to) return;
  store.setFlight({ active, progress: value, to });
}

function createDirectorState(target: SceneTarget, path: string): DirectorState {
  return {
    initialized: false,
    age: 0,
    target,
    targetPath: path,
    goal: null,
    goalPose: { target: [0, 0, 0], radius: 1, azimuth: 0, polar: Math.PI / 2 },
    goalModel: null,
    goalAspect: 0,
    goalPlanetAngle: undefined,
    goalEmphasis: undefined,
    azimuthOffset: 0,
    settledRadius: 1,
    safeRect: undefined,
    viewportWidth: 0,
    viewportHeight: 0,
    canvasLeft: 0,
    canvasTop: 0,
    frame: FULL_FRAME,
    fov: { value: CAMERA.fov, velocity: 0 },
    centerX: { value: 0.5, velocity: 0 },
    centerY: { value: 0.5, velocity: 0 },
    flight: null,
    flashTail: null,
    cut: null,
    revealed: false,
    inputPending: false,
    inputWheel: false,
    dragging: false,
    dragVelocity: { azimuth: 0, polar: 0 },
    dragPrev: null,
    idleClock: 0,
    swayApplied: 0,
    settledAt: 0,
    parallaxX: 0,
    parallaxY: 0,
    refreshHover: false,
  };
}

function snapCenter(d: DirectorState, center: { x: number; y: number }) {
  d.centerX = { value: center.x, velocity: 0 };
  d.centerY = { value: center.y, velocity: 0 };
}

function sameFrame(a: SafeFrame, b: SafeFrame): boolean {
  return (
    Math.abs(a.x - b.x) < FRAME_EPSILON &&
    Math.abs(a.y - b.y) < FRAME_EPSILON &&
    Math.abs(a.width - b.width) < FRAME_EPSILON &&
    Math.abs(a.height - b.height) < FRAME_EPSILON
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Category whose planets take input on this route (system / planet), else null. */
function systemCategory(target: SceneTarget): string | null {
  return target.mode === 'system' || target.mode === 'planet' ? target.category : null;
}
