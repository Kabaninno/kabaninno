/**
 * Critically damped smoothing (Unity-style SmoothDamp): eases in and out, never
 * overshoots — matches the "heavy, calm, no springs" motion direction. Pure and
 * frame-rate independent; operates on any {x,y,z} object in place.
 */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface ScalarDampState {
  value: number;
  velocity: number;
}

/** Smoothly moves `state.value` toward `target`; returns the new value. */
export function smoothDamp(
  state: ScalarDampState,
  target: number,
  smoothTime: number,
  dt: number,
): number {
  if (dt <= 0) return state.value;
  const time = Math.max(0.0001, smoothTime);
  const omega = 2 / time;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - target;
  const temp = (state.velocity + omega * change) * dt;
  let velocity = (state.velocity - omega * temp) * decay;
  let output = target + (change + temp) * decay;
  // Never overshoot the target.
  if (target - state.value > 0 === output > target) {
    output = target;
    velocity = 0;
  }
  state.value = output;
  state.velocity = velocity;
  return output;
}

const scratch: ScalarDampState = { value: 0, velocity: 0 };

/** Vector variant of `smoothDamp`; mutates `current` and `velocity`. */
export function smoothDampVec3(
  current: Vec3Like,
  target: Vec3Like,
  velocity: Vec3Like,
  smoothTime: number,
  dt: number,
): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    scratch.value = current[axis];
    scratch.velocity = velocity[axis];
    smoothDamp(scratch, target[axis], smoothTime, dt);
    current[axis] = scratch.value;
    velocity[axis] = scratch.velocity;
  }
}

/** Frame-rate independent exponential approach factor for `rate` (1/s). */
export function dampFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}
