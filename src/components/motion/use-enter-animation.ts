'use client';

import { useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

const subscribeNever = () => () => {};

/** Class that plays the entrance (globals.css). */
export const ENTER_CLASS = 'ui-enter';
/** Class that keeps an element invisible while its entrance waits for a gate. */
export const ENTER_PENDING_CLASS = 'ui-enter-pending';

/**
 * `true` while React hydrates server HTML, `false` for a fresh client render
 * (client-side navigation). React re-renders once after hydration with the
 * client value; callers capture the value of their first render.
 */
export function useIsHydrating(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true,
  );
}

/**
 * Holds an entrance back until `start(reason)` is called; returns a cleanup
 * that cancels the wait (unmount). Must be a stable reference (module-level
 * function), otherwise the entrance would restart on every render.
 */
export type EnterGate = (start: (reason: string) => void) => () => void;

export interface EnterAnimationOptions {
  /** Delay before the entrance starts (the element stays invisible meanwhile). */
  delayMs?: number;
  /** Delay used under prefers-reduced-motion (plain fade). */
  reducedDelayMs?: number;
  /**
   * Waits for an external signal (e.g. the camera flight) before the
   * entrance starts. Ignored under prefers-reduced-motion, where only
   * `reducedDelayMs` applies.
   */
  gate?: EnterGate;
}

/**
 * Plays the art-direction entrance (`.ui-enter` in globals.css) when the
 * element mounts during a client-side navigation. Elements that are part of
 * the initial server HTML never animate: no opacity/delay on first load, so
 * LCP is not postponed and nothing flashes during hydration (D29).
 *
 * The class is added in a layout effect (before the first paint of the new
 * route) and removed again on `animationend`, so React never fights over it.
 * With a `gate`, the element is held invisible (`.ui-enter-pending`, no
 * pointer events) until the gate opens; the reason is written to
 * `data-reveal-reason` so reviewers can tell how it was revealed.
 */
export function useEnterAnimation<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { delayMs = 0, reducedDelayMs = 0, gate }: EnterAnimationOptions = {},
): void {
  const hydrating = useIsHydrating();
  // Only the value from the first render matters: it tells how we mounted.
  const mountedDuringHydration = useRef(hydrating);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || mountedDuringHydration.current) return;

    const play = (reason?: string) => {
      if (delayMs > 0) element.style.setProperty('--ui-enter-delay', `${delayMs}ms`);
      if (reducedDelayMs > 0) {
        element.style.setProperty('--ui-enter-delay-reduced', `${reducedDelayMs}ms`);
      }
      element.classList.remove(ENTER_PENDING_CLASS);
      element.classList.add(ENTER_CLASS);
      if (reason) element.dataset.revealReason = reason;
    };
    const finish = (event: AnimationEvent) => {
      if (event.target !== element) return;
      element.classList.remove(ENTER_CLASS);
      element.style.removeProperty('--ui-enter-delay');
      element.style.removeProperty('--ui-enter-delay-reduced');
    };
    element.addEventListener('animationend', finish);

    let release: (() => void) | undefined;
    if (gate && !prefersReducedMotion()) {
      element.classList.add(ENTER_PENDING_CLASS);
      release = gate(play);
    } else {
      play(gate ? 'reduced-motion' : undefined);
    }

    return () => {
      release?.();
      element.removeEventListener('animationend', finish);
    };
  }, [ref, delayMs, reducedDelayMs, gate]);
}
