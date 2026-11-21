'use client';

import { useRef, type PointerEvent } from 'react';
import { sheetDragOffset, sheetGesture } from '@/lib/sheet';
import { useUiStore } from '@/store/ui';

interface SheetHandleProps {
  /** Accessible name (constant; `aria-expanded` carries the state). */
  label: string;
  /** id of the sheet's scrolling region. */
  controls: string;
}

/** The sheet frame the handle moves (the route UI root around it). */
function sheetOf(element: Element): HTMLElement | null {
  return element.closest<HTMLElement>('[data-route-ui]');
}

/**
 * Handle of the mobile bottom sheet (hidden from md up, where panels are a
 * side column). A real button: tap, Enter or Space toggles between expanded
 * (60 % of the height) and collapsed (a peek that leaves the planet visible);
 * dragging it down collapses and up expands, with the sheet following the
 * finger meanwhile. The state lives in `store/ui.ts`, so it survives
 * planet-to-planet navigation. Under reduced motion the height change is
 * instant (global CSS). The sheet's new height reaches the camera through
 * SafeAreaPublisher's ResizeObserver.
 */
export function SheetHandle({ label, controls }: SheetHandleProps) {
  const collapsed = useUiStore((state) => state.sheetCollapsed);
  const setCollapsed = useUiStore((state) => state.setSheetCollapsed);
  const drag = useRef<{ id: number; y: number; dy: number } | null>(null);
  const swallowClick = useRef(false);

  const reset = (target: Element) => {
    const sheet = sheetOf(target);
    if (sheet) {
      sheet.style.removeProperty('transform');
      sheet.style.removeProperty('transition');
    }
    drag.current = null;
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, y: event.clientY, dy: 0 };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    current.dy = event.clientY - current.y;
    const sheet = sheetOf(event.currentTarget);
    if (!sheet || sheetGesture(current.dy, collapsed) === 'tap') return;
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${sheetDragOffset(current.dy, collapsed)}px)`;
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const gesture = sheetGesture(current.dy, collapsed);
    reset(event.currentTarget);
    if (gesture === 'tap') return; // the click that follows toggles
    swallowClick.current = true;
    if (gesture === 'collapse') setCollapsed(true);
    if (gesture === 'expand') setCollapsed(false);
  };

  return (
    <div className="flex shrink-0 justify-center md:hidden">
      <button
        type="button"
        data-sheet-handle=""
        aria-label={label}
        aria-expanded={!collapsed}
        aria-controls={controls}
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          setCollapsed(!collapsed);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(event) => reset(event.currentTarget)}
        className="group/handle -mb-1 flex h-11 w-28 touch-none items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-offset-[-4px] active:bg-white/[0.06]"
      >
        <span
          aria-hidden="true"
          className="h-1 w-10 rounded-full bg-white/20 transition-colors duration-150 group-hover/handle:bg-white/40 group-focus-visible/handle:bg-white/50"
        />
      </button>
    </div>
  );
}
