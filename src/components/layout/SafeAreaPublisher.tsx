'use client';

import { useEffect } from 'react';
import {
  SCENE_OVERLAY_ATTRIBUTE,
  largestFreeRect,
  preferredFrameAspect,
  sameRect,
  type Rect,
  type ViewportSize,
} from '@/lib/safe-rect';
import { useSceneStore } from '@/store/scene';

declare global {
  interface Window {
    /** Debug hook (`?debug=1`, like D19): the last published safe rect. */
    __safeRect?: Rect | null;
  }
}

const OVERLAY_SELECTOR = `[${SCENE_OVERLAY_ATTRIBUTE}]`;
const SCENE_ROOT_SELECTOR = '[data-scene-root]';

/** DOM changes inside the 3D layer (labels, canvas) never move an overlay. */
function outsideScene(record: MutationRecord): boolean {
  const target = record.target;
  return !(target instanceof Element && target.closest(SCENE_ROOT_SELECTOR));
}

/** An entrance animation that ran on (or around) an overlay may have moved it. */
function touchesOverlay(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(OVERLAY_SELECTOR) !== null || target.querySelector(OVERLAY_SELECTOR) !== null
  );
}

function viewportSize(): ViewportSize {
  // The canvas fills the fixed scene root; measure it when it exists.
  const sceneRoot = document.querySelector(SCENE_ROOT_SELECTOR);
  if (sceneRoot) {
    const { width, height } = sceneRoot.getBoundingClientRect();
    if (width > 0 && height > 0) return { width, height };
  }
  return { width: document.documentElement.clientWidth, height: window.innerHeight };
}

/**
 * Publishes `safeRect` (scene store): the largest free part of the viewport
 * that no HTML overlay of the current route covers — HUD, home hero and
 * category index, content panel / bottom sheet. Overlays opt in with the
 * `data-scene-overlay` attribute; boxes come from the real elements.
 *
 * Event driven, never per frame: a ResizeObserver on every overlay, a
 * MutationObserver for overlays (dis)appearing on route changes, window
 * resize, and `animationend` (entrance animations translate panels by a few
 * pixels). Bursts are coalesced into one measurement per animation frame, and
 * the store is written only when the rect actually changes.
 *
 * Consumers (camera) add their own padding; `null` means "whole viewport".
 */
export function SafeAreaPublisher() {
  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).get('debug') === '1';
    const observed = new Set<Element>();
    let frame = 0;
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(publish);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const mutationObserver = new MutationObserver((records) => {
      if (records.some(outsideScene)) schedule();
    });
    const onAnimationEnd = (event: AnimationEvent) => {
      if (touchesOverlay(event.target)) schedule();
    };

    function publish() {
      frame = 0;
      const overlays = Array.from(document.querySelectorAll(OVERLAY_SELECTOR));
      for (const element of observed) {
        if (!overlays.includes(element)) {
          resizeObserver.unobserve(element);
          observed.delete(element);
        }
      }
      for (const element of overlays) {
        if (!observed.has(element)) {
          resizeObserver.observe(element);
          observed.add(element);
        }
      }
      const viewport = viewportSize();
      const obstacles = overlays.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      });
      const rect = largestFreeRect(viewport, obstacles, preferredFrameAspect(viewport));
      const store = useSceneStore.getState();
      if (!sameRect(store.safeRect, rect)) store.setSafeRect(rect);
      if (debug) window.__safeRect = rect;
    }

    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('animationend', onAnimationEnd, true);
    schedule();

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('animationend', onAnimationEnd, true);
    };
  }, []);

  return null;
}
