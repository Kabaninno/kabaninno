'use client';

import { useEffect, useRef } from 'react';
import { useSceneStore } from '@/store/scene';
import {
  advanceTour,
  createTour,
  isOwnHighlight,
  stopTour,
  type TourAction,
  type TourState,
} from './tour';

/** Poll interval of the tour clock, ms (a few timer wake-ups per second, no frame work). */
const TICK_MS = 250;
/** A tick never advances the tour by more than this (a throttled timer after a hidden tab). */
const MAX_STEP_MS = 500;
/** Events that count as the visitor's first interaction. */
const INTERACTION_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;

interface IdleTourProps {
  /** Highlight ids of the categories, in content order. */
  ids: readonly string[];
  /** The universe is on screen (revealed). */
  shown: boolean;
  /** The URL is the home view (the universe overview). */
  home: boolean;
  /** Reduced motion: the tour never runs. */
  reducedMotion: boolean;
}

/**
 * Idle tour driver (B1): lights the category nodes one by one through the
 * store's `highlighted` field (the 3D label and the list card follow it, see
 * HighlightLink) until the visitor does something. Sequencing lives in
 * `tour.ts`; this component only supplies the clock, the conditions and the
 * store writes — no scene work, no React state, no per-frame cost (a 250 ms
 * timer; none at all once stopped).
 *
 * Stops for good on: pointer / touch / key / wheel input, a highlight set by
 * anyone else (hover, focus), a flight, leaving the home view, reduced motion,
 * the end of the second pass. Pauses while the tab is hidden or the intro
 * plays. When it stops it clears only a highlight it wrote itself.
 */
export function IdleTour({ ids, shown, home, reducedMotion }: IdleTourProps) {
  const live = useRef({ ids, shown, home, reducedMotion });
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    live.current = { ids, shown, home, reducedMotion };
    if (!home || reducedMotion) stopRef.current();
  }, [ids, shown, home, reducedMotion]);

  useEffect(() => {
    let state: TourState = createTour();
    let written: string | null = null;
    let lastTick = performance.now();
    let timer: number | null = null;

    const apply = (action: TourAction) => {
      const store = useSceneStore.getState();
      if (action.type === 'light') {
        written = action.id;
        store.setHighlighted(action.id);
      } else if (action.type === 'clear') {
        // Never clear someone else's highlight.
        const own = written !== null && store.highlighted === written;
        written = null;
        if (own) store.setHighlighted(null);
      }
    };

    const teardown = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      for (const type of INTERACTION_EVENTS) window.removeEventListener(type, onInteraction, true);
      unsubscribe();
    };

    const stop = () => {
      if (state.status === 'stopped') return;
      const result = stopTour(state);
      state = result.state;
      apply(result.action);
      teardown();
    };
    stopRef.current = stop;

    function onInteraction() {
      stop();
    }

    const unsubscribe = useSceneStore.subscribe((next, previous) => {
      if (next.highlighted !== previous.highlighted && !isOwnHighlight(next.highlighted, written)) {
        stop();
      } else if (next.flight.active && !previous.flight.active) {
        stop();
      }
    });

    const tick = () => {
      const now = performance.now();
      const dtMs = Math.min(now - lastTick, MAX_STEP_MS);
      lastTick = now;
      const store = useSceneStore.getState();
      const { ids: tourIds, shown: isShown, home: isHome, reducedMotion: reduced } = live.current;
      // Left the home view (or never was on it), or motion is reduced: not this visit's tour.
      if (!isHome || reduced) return stop();
      if (store.flight.active) return stop();
      // Someone else already highlights a node (hover, focus): the visitor is driving.
      if (store.highlighted !== null && !isOwnHighlight(store.highlighted, written)) return stop();
      const canRun =
        isShown &&
        isHome &&
        document.visibilityState !== 'hidden' &&
        !store.introActive &&
        store.focus !== null;
      const result = advanceTour(state, { ids: tourIds, dtMs, canRun });
      state = result.state;
      apply(result.action);
      if (state.status === 'stopped') teardown();
    };

    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, onInteraction, { capture: true, passive: true });
    }
    timer = window.setInterval(tick, TICK_MS);
    return stop;
  }, []);

  return null;
}
