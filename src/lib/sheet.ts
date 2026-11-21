/**
 * Mobile bottom sheet handle: what a finished pointer gesture on the handle
 * means. Pure logic; the DOM side is `components/panel/SheetHandle.tsx`.
 */
export const SHEET_GESTURE = {
  /** Up to this travel (CSS px) the gesture is a tap (toggles like a click). */
  tapPx: 8,
  /** A drag this far down collapses, this far up expands. */
  dragPx: 40,
} as const;

export type SheetGesture = 'tap' | 'collapse' | 'expand' | 'stay';

/** @param dy vertical travel, positive = downwards */
export function sheetGesture(dy: number, collapsed: boolean): SheetGesture {
  if (Math.abs(dy) <= SHEET_GESTURE.tapPx) return 'tap';
  if (dy >= SHEET_GESTURE.dragPx) return collapsed ? 'stay' : 'collapse';
  if (dy <= -SHEET_GESTURE.dragPx) return collapsed ? 'expand' : 'stay';
  return 'stay';
}

/**
 * Visual drag offset while the finger is down: follows the finger downwards
 * from expanded and upwards from collapsed, with resistance the other way.
 */
export function sheetDragOffset(dy: number, collapsed: boolean): number {
  if (collapsed) return dy < 0 ? dy : dy / 4;
  return dy > 0 ? dy : dy / 4;
}
