'use client';

import { useEffect, type RefObject } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ownsArrowKeys, planetKeyStep, swipeStep, type PlanetStep } from '@/lib/planet-nav';

/** Locale-less paths of the neighbouring planets (wrapping around the system). */
export interface PanelSiblings {
  previous: string;
  next: string;
  /**
   * `replace` between planets (D16: Back returns to the system, not through
   * every planet); `push` from the system itself, where → / ← enter a planet
   * just like a click on it. Default `replace`.
   */
  history?: 'push' | 'replace';
}

/** A dialog or a HUD menu (Services) is open: arrows belong to it. */
function overlayOpen(): boolean {
  return (
    document.querySelector('dialog[open], [aria-modal="true"], header [aria-expanded="true"]') !==
    null
  );
}

/**
 * Planet switching on system and planet routes (BRIEF scene 2, D16): ←/→
 * anywhere on the page (see `planetKeyStep` for what is ignored) and a
 * horizontal touch swipe on the panel / bottom sheet (`swipeStep`). Between
 * planets both use `router.replace`, so Back returns to the system, not
 * through every planet; from the system they push (see `history`).
 * The panel frame sets `touch-action: pan-y`, so vertical scrolling stays
 * native and a horizontal swipe reaches these pointer handlers.
 */
export function usePanelSiblings(
  frameRef: RefObject<HTMLElement | null>,
  siblings: PanelSiblings | undefined,
): void {
  const router = useRouter();
  const previous = siblings?.previous;
  const next = siblings?.next;
  const history = siblings?.history ?? 'replace';

  useEffect(() => {
    if (previous === undefined || next === undefined) return;
    // One move per panel: until the next route's panel mounts (it brings its
    // own neighbours), a second key press here would repeat the same move.
    let moved = false;
    const go = (step: PlanetStep) => {
      if (moved) return;
      moved = true;
      const path = step === 'next' ? next : previous;
      if (history === 'push') router.push(path);
      else router.replace(path);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const step = planetKeyStep(event, {
        ownsArrows: ownsArrowKeys(target) || ownsArrowKeys(active),
        overlayOpen: overlayOpen(),
      });
      if (step === null) return;
      event.preventDefault();
      go(step);
    };

    const frame = frameRef.current;
    let start: { id: number; x: number; y: number; time: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      if (event.target instanceof Element && event.target.closest('[data-sheet-handle]')) return;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const step = swipeStep({
        dx: event.clientX - start.x,
        dy: event.clientY - start.y,
        durationMs: event.timeStamp - start.time,
        startX: start.x,
        viewportWidth: window.innerWidth,
      });
      start = null;
      if (step) go(step);
    };
    // The browser took the gesture over (vertical scroll): not a swipe.
    const onPointerCancel = () => {
      start = null;
    };

    window.addEventListener('keydown', onKeyDown);
    frame?.addEventListener('pointerdown', onPointerDown);
    frame?.addEventListener('pointerup', onPointerUp);
    frame?.addEventListener('pointercancel', onPointerCancel);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      frame?.removeEventListener('pointerdown', onPointerDown);
      frame?.removeEventListener('pointerup', onPointerUp);
      frame?.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [frameRef, router, previous, next, history]);
}
