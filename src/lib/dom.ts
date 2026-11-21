/**
 * Client-side DOM helpers (call from event handlers only).
 */

/** True when an event target belongs to the 3D scene layer (the canvas behind the UI). */
export function isSceneTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-scene-root]') !== null;
}

/**
 * Swallows the click that completes the current pointer gesture (capture
 * phase, before any other listener), so e.g. the press that dismisses a menu
 * does not also fly the camera to a node underneath. The guard expires as soon
 * as the gesture ends, whether or not a click follows (drag, cancel).
 */
export function swallowGestureClick(): void {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  const cleanup = () => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('pointerup', onGestureEnd, true);
    window.removeEventListener('pointercancel', onGestureEnd, true);
  };
  // `click` is dispatched right after `pointerup` in the same task.
  const onGestureEnd = () => window.setTimeout(cleanup, 0);
  window.addEventListener('click', swallow, true);
  window.addEventListener('pointerup', onGestureEnd, true);
  window.addEventListener('pointercancel', onGestureEnd, true);
}
