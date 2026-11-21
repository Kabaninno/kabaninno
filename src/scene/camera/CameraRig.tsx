'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { SceneTarget } from '@/lib/route-state';
import { useSceneStore, type SafeRect } from '@/store/scene';
import { CAMERA, MOTION } from '../config';
import { isPerspectiveCamera } from '../three-utils';
import type { UniverseModel } from '../universe/model';
import { smoothDamp, smoothDampVec3, type ScalarDampState } from './damp';
import {
  FULL_FRAME,
  computeCameraGoal,
  frameCenter,
  resolveSafeFrame,
  viewOffsetForCenter,
  type CameraGoal,
  type SafeFrame,
} from './goals';

interface CameraRigProps {
  target: SceneTarget;
  model: UniverseModel;
  reducedMotion: boolean;
  /** Mouse/trackpad primary pointer: enables subtle pointer parallax. */
  finePointer: boolean;
}

interface RigState {
  initialized: boolean;
  /** Seconds since the first frame. */
  age: number;
  /** Inputs of the cached goal (recomputed only when one of them changes). */
  goal: CameraGoal | null;
  goalTarget: SceneTarget | null;
  goalModel: UniverseModel | null;
  goalAspect: number;
  /** Last store value / viewport size the frame was resolved from. */
  safeRect: SafeRect | null | undefined;
  viewportWidth: number;
  viewportHeight: number;
  canvasLeft: number;
  canvasTop: number;
  frame: SafeFrame;
  /** Eased principal point (viewport fractions); follows the frame centre. */
  centerX: ScalarDampState;
  centerY: ScalarDampState;
  position: Vector3;
  velocity: Vector3;
  look: Vector3;
  lookVelocity: Vector3;
  fov: ScalarDampState;
  goalPosition: Vector3;
  goalLook: Vector3;
  right: Vector3;
  up: Vector3;
  /** Reduced-motion crossfade: ms elapsed, or -1 when idle. */
  cutElapsed: number;
}

/** Pull-back factor of the opening shot (camera settles in while the canvas fades in). */
const INTRO_PULLBACK = 0.32;
/**
 * The UI usually publishes its safe rect before the first frame; if it lands
 * while the canvas is still fading in, the framing snaps instead of sliding.
 */
const INTRO_SNAP_SECONDS = 0.5;
/** Frame changes below this (viewport fractions) are ignored. */
const FRAME_EPSILON = 1e-4;

/**
 * Placeholder camera director: critically damped approach to the goal derived
 * from the URL. M2 replaces the motion with CameraControls + GSAP flights, but
 * keeps `computeCameraGoal` as the single mapping from SceneTarget to framing.
 *
 * Safe-area framing (D28): the free part of the viewport (`safeRect` in the
 * scene store, published by the UI) is read every frame without subscribing,
 * so overlay changes never re-render React. The goal is fitted into that
 * frame and the principal point is moved to its centre via
 * `camera.setViewOffset`; both ease with the camera's smoothing time. Under
 * prefers-reduced-motion the camera cuts behind a 300 ms canvas crossfade and
 * frame changes apply immediately.
 */
export function CameraRig({ target, model, reducedMotion, finePointer }: CameraRigProps) {
  // Mutable motion state lives in a ref (created lazily on the first frame).
  const rigRef = useRef<RigState | null>(null);
  const camera = useThree((state) => state.camera);

  // Leave the shared camera without a principal-point shift when the rig goes away.
  useEffect(
    () => () => {
      if (isPerspectiveCamera(camera)) camera.clearViewOffset();
    },
    [camera],
  );

  useFrame((state, delta) => {
    const cam = state.camera;
    if (!isPerspectiveCamera(cam)) return;
    const { width, height, left, top } = state.size;
    if (!(width > 0) || !(height > 0)) return;
    const rig = rigRef.current ?? (rigRef.current = createRigState());
    const dt = Math.min(delta, 0.1);
    const canvas = state.gl.domElement;
    const aspect = width / height;

    // Free frame: a non-reactive store read, resolved only when its inputs change.
    const safeRect = useSceneStore.getState().safeRect;
    let frameChanged = false;
    if (
      safeRect !== rig.safeRect ||
      width !== rig.viewportWidth ||
      height !== rig.viewportHeight ||
      left !== rig.canvasLeft ||
      top !== rig.canvasTop
    ) {
      rig.safeRect = safeRect;
      rig.viewportWidth = width;
      rig.viewportHeight = height;
      rig.canvasLeft = left;
      rig.canvasTop = top;
      // The rect is in viewport px; the canvas is fixed at inset 0, but stay exact if it is not.
      const local = safeRect ? { ...safeRect, x: safeRect.x - left, y: safeRect.y - top } : null;
      const next = resolveSafeFrame(local, width, height);
      frameChanged = !sameFrame(next, rig.frame);
      if (frameChanged) rig.frame = next;
    }

    const targetChanged = target !== rig.goalTarget;
    if (
      rig.goal === null ||
      targetChanged ||
      model !== rig.goalModel ||
      aspect !== rig.goalAspect ||
      frameChanged
    ) {
      rig.goal = computeCameraGoal(target, model, aspect, rig.frame);
      rig.goalModel = model;
      rig.goalAspect = aspect;
    }
    const goal = rig.goal;
    const center = frameCenter(rig.frame);
    rig.goalPosition.fromArray(goal.position);
    rig.goalLook.fromArray(goal.lookAt);

    if (!rig.initialized) {
      rig.initialized = true;
      rig.goalTarget = target;
      snapTo(rig, goal, center);
      if (!reducedMotion) {
        rig.position
          .sub(rig.goalLook)
          .multiplyScalar(1 + INTRO_PULLBACK)
          .add(rig.goalLook);
      }
    } else if (targetChanged) {
      // A new URL target under reduced motion → crossfade cut.
      if (reducedMotion) rig.cutElapsed = 0;
      rig.goalTarget = target;
    }
    rig.age += dt;
    if (frameChanged && rig.age < INTRO_SNAP_SECONDS) snapCenter(rig, center);

    if (reducedMotion) {
      // Hold the old view until the crossfade midpoint; otherwise sit exactly on the goal.
      let hold = false;
      if (rig.cutElapsed >= 0) {
        rig.cutElapsed += dt * 1000;
        const half = MOTION.reducedCutMs / 2;
        hold = rig.cutElapsed < half;
        const t = hold ? rig.cutElapsed / half : 2 - rig.cutElapsed / half;
        canvas.style.opacity = String(1 - Math.min(Math.max(t, 0), 1));
        if (rig.cutElapsed >= MOTION.reducedCutMs) {
          rig.cutElapsed = -1;
          canvas.style.opacity = '';
        }
      }
      if (!hold) snapTo(rig, goal, center);
    } else {
      if (rig.cutElapsed >= 0) {
        rig.cutElapsed = -1;
        canvas.style.opacity = '';
      }
      // Calm idle sway + subtle pointer parallax, proportional to the view distance.
      const distance = rig.goalPosition.distanceTo(rig.goalLook);
      const time = state.clock.elapsedTime;
      rig.right.setFromMatrixColumn(cam.matrixWorld, 0);
      rig.up.setFromMatrixColumn(cam.matrixWorld, 1);
      const swayX = Math.sin(time * 0.045) * 0.012 * distance;
      const swayY = Math.sin(time * 0.031 + 1.3) * 0.006 * distance;
      const parallaxX = finePointer ? state.pointer.x * 0.022 * distance : 0;
      const parallaxY = finePointer ? state.pointer.y * 0.012 * distance : 0;
      rig.goalPosition.addScaledVector(rig.right, swayX + parallaxX);
      rig.goalPosition.addScaledVector(rig.up, swayY + parallaxY);

      smoothDampVec3(rig.position, rig.goalPosition, rig.velocity, MOTION.cameraSmoothTime, dt);
      smoothDampVec3(rig.look, rig.goalLook, rig.lookVelocity, MOTION.lookSmoothTime, dt);
      smoothDamp(rig.fov, goal.fov, MOTION.fovSmoothTime, dt);
      // The principal point travels with the camera, so overlay changes ease the same way.
      smoothDamp(rig.centerX, center.x, MOTION.cameraSmoothTime, dt);
      smoothDamp(rig.centerY, center.y, MOTION.cameraSmoothTime, dt);
    }

    cam.position.copy(rig.position);
    cam.lookAt(rig.look);

    // Adaptive near plane: precision follows the view distance (universe ↔ nested system).
    const viewDistance = rig.position.distanceTo(rig.look);
    const near = Math.min(
      Math.max(viewDistance * CAMERA.nearFactor, CAMERA.minNear),
      CAMERA.maxNear,
    );
    const offset = viewOffsetForCenter(rig.centerX.value, rig.centerY.value, width, height);
    const view = cam.view;
    const viewChanged =
      view === null ||
      !view.enabled ||
      view.fullWidth !== width ||
      view.fullHeight !== height ||
      Math.abs(view.offsetX - offset.x) > 0.01 ||
      Math.abs(view.offsetY - offset.y) > 0.01;
    const nearChanged = Math.abs(near - cam.near) / cam.near > 0.08;
    const fovChanged = Math.abs(rig.fov.value - cam.fov) > 0.01;
    if (viewChanged || nearChanged || fovChanged || cam.far !== CAMERA.far) {
      cam.near = near;
      cam.far = CAMERA.far;
      cam.fov = rig.fov.value;
      // Full-size window shifted by the offset; also sets the aspect and updates the projection.
      cam.setViewOffset(width, height, offset.x, offset.y, width, height);
    }
  });

  return null;
}

function createRigState(): RigState {
  return {
    initialized: false,
    age: 0,
    goal: null,
    goalTarget: null,
    goalModel: null,
    goalAspect: 0,
    safeRect: undefined,
    viewportWidth: 0,
    viewportHeight: 0,
    canvasLeft: 0,
    canvasTop: 0,
    frame: FULL_FRAME,
    centerX: { value: 0.5, velocity: 0 },
    centerY: { value: 0.5, velocity: 0 },
    position: new Vector3(),
    velocity: new Vector3(),
    look: new Vector3(),
    lookVelocity: new Vector3(),
    fov: { value: CAMERA.fov, velocity: 0 },
    goalPosition: new Vector3(),
    goalLook: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    cutElapsed: -1,
  };
}

function snapTo(rig: RigState, goal: CameraGoal, center: { x: number; y: number }) {
  rig.position.fromArray(goal.position);
  rig.look.fromArray(goal.lookAt);
  rig.velocity.set(0, 0, 0);
  rig.lookVelocity.set(0, 0, 0);
  rig.fov.value = goal.fov;
  rig.fov.velocity = 0;
  snapCenter(rig, center);
}

function snapCenter(rig: RigState, center: { x: number; y: number }) {
  rig.centerX.value = center.x;
  rig.centerX.velocity = 0;
  rig.centerY.value = center.y;
  rig.centerY.velocity = 0;
}

function sameFrame(a: SafeFrame, b: SafeFrame): boolean {
  return (
    Math.abs(a.x - b.x) < FRAME_EPSILON &&
    Math.abs(a.y - b.y) < FRAME_EPSILON &&
    Math.abs(a.width - b.width) < FRAME_EPSILON &&
    Math.abs(a.height - b.height) < FRAME_EPSILON
  );
}
