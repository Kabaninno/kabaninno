'use client';

import { useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';

const subscribeNever = () => () => {};

/**
 * `true` while React hydrates server HTML, `false` for a fresh client render
 * (client-side navigation). React re-renders once after hydration with the
 * client value; callers capture the value of their first render.
 */
function useIsHydrating(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true,
  );
}

export interface EnterAnimationOptions {
  /** Delay before the entrance starts (the element stays invisible meanwhile). */
  delayMs?: number;
  /** Delay used under prefers-reduced-motion (plain fade). */
  reducedDelayMs?: number;
}

/**
 * Plays the art-direction entrance (`.ui-enter` in globals.css) when the
 * element mounts during a client-side navigation. Elements that are part of
 * the initial server HTML never animate: no opacity/delay on first load, so
 * LCP is not postponed and nothing flashes during hydration.
 *
 * The class is added in a layout effect (before the first paint of the new
 * route) and removed again on `animationend`, so React never fights over it.
 */
export function useEnterAnimation<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { delayMs = 0, reducedDelayMs = 0 }: EnterAnimationOptions = {},
): void {
  const hydrating = useIsHydrating();
  // Only the value from the first render matters: it tells how we mounted.
  const mountedDuringHydration = useRef(hydrating);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || mountedDuringHydration.current) return;
    if (delayMs > 0) element.style.setProperty('--ui-enter-delay', `${delayMs}ms`);
    if (reducedDelayMs > 0) {
      element.style.setProperty('--ui-enter-delay-reduced', `${reducedDelayMs}ms`);
    }
    element.classList.add('ui-enter');
    const finish = (event: AnimationEvent) => {
      if (event.target !== element) return;
      element.classList.remove('ui-enter');
      element.style.removeProperty('--ui-enter-delay');
      element.style.removeProperty('--ui-enter-delay-reduced');
    };
    element.addEventListener('animationend', finish);
    return () => element.removeEventListener('animationend', finish);
  }, [ref, delayMs, reducedDelayMs]);
}
