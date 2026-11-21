import { describe, expect, it } from 'vitest';
import { SHEET_GESTURE, sheetDragOffset, sheetGesture } from './sheet';

describe('sheetGesture', () => {
  it('treats a short movement as a tap', () => {
    expect(sheetGesture(0, false)).toBe('tap');
    expect(sheetGesture(SHEET_GESTURE.tapPx, true)).toBe('tap');
    expect(sheetGesture(-SHEET_GESTURE.tapPx, false)).toBe('tap');
  });

  it('collapses on a drag down and expands on a drag up', () => {
    expect(sheetGesture(SHEET_GESTURE.dragPx, false)).toBe('collapse');
    expect(sheetGesture(-SHEET_GESTURE.dragPx, true)).toBe('expand');
  });

  it('stays for drags towards the current state or too short to count', () => {
    expect(sheetGesture(120, true)).toBe('stay');
    expect(sheetGesture(-120, false)).toBe('stay');
    expect(sheetGesture(SHEET_GESTURE.dragPx - 1, false)).toBe('stay');
  });
});

describe('sheetDragOffset', () => {
  it('follows the finger in the direction of the next state, with resistance otherwise', () => {
    expect(sheetDragOffset(60, false)).toBe(60);
    expect(sheetDragOffset(-60, false)).toBe(-15);
    expect(sheetDragOffset(-60, true)).toBe(-60);
    expect(sheetDragOffset(60, true)).toBe(15);
  });
});
