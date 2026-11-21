import { describe, expect, it } from 'vitest';
import { SWIPE, ownsArrowKeys, planetKeyStep, swipeStep, type PlanetKeyLike } from './planet-nav';

const key = (name: string, overrides: Partial<PlanetKeyLike> = {}): PlanetKeyLike => ({
  key: name,
  defaultPrevented: false,
  ...overrides,
});
const free = { ownsArrows: false, overlayOpen: false };

describe('planetKeyStep', () => {
  it('maps → to next and ← to previous', () => {
    expect(planetKeyStep(key('ArrowRight'), free)).toBe('next');
    expect(planetKeyStep(key('ArrowLeft'), free)).toBe('previous');
  });

  it('ignores other keys', () => {
    expect(planetKeyStep(key('ArrowUp'), free)).toBeNull();
    expect(planetKeyStep(key('ArrowDown'), free)).toBeNull();
    expect(planetKeyStep(key('Enter'), free)).toBeNull();
  });

  it('ignores consumed, repeated and composing events', () => {
    expect(planetKeyStep(key('ArrowRight', { defaultPrevented: true }), free)).toBeNull();
    expect(planetKeyStep(key('ArrowRight', { repeat: true }), free)).toBeNull();
    expect(planetKeyStep(key('ArrowRight', { isComposing: true }), free)).toBeNull();
  });

  it('ignores modifiers (Alt+← is browser Back)', () => {
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const) {
      expect(planetKeyStep(key('ArrowLeft', { [modifier]: true }), free)).toBeNull();
    }
  });

  it('ignores widgets that own arrows and open dialogs or menus', () => {
    expect(planetKeyStep(key('ArrowRight'), { ownsArrows: true, overlayOpen: false })).toBeNull();
    expect(planetKeyStep(key('ArrowRight'), { ownsArrows: false, overlayOpen: true })).toBeNull();
  });
});

describe('ownsArrowKeys', () => {
  const el = (tagName: string, extra: { role?: string; editable?: boolean } = {}) => ({
    tagName,
    isContentEditable: extra.editable ?? false,
    getAttribute: (name: string) => (name === 'role' ? (extra.role ?? null) : null),
  });

  it('detects form fields, contenteditable and arrow widgets', () => {
    expect(ownsArrowKeys(el('INPUT'))).toBe(true);
    expect(ownsArrowKeys(el('textarea'))).toBe(true);
    expect(ownsArrowKeys(el('SELECT'))).toBe(true);
    expect(ownsArrowKeys(el('DIV', { editable: true }))).toBe(true);
    expect(ownsArrowKeys(el('DIV', { role: 'slider' }))).toBe(true);
    expect(ownsArrowKeys(el('DIV', { role: 'tab' }))).toBe(true);
  });

  it('lets links, buttons, headings and the panel scroller through', () => {
    expect(ownsArrowKeys(el('A'))).toBe(false);
    expect(ownsArrowKeys(el('BUTTON'))).toBe(false);
    expect(ownsArrowKeys(el('H1'))).toBe(false);
    expect(ownsArrowKeys(el('SECTION', { role: 'region' }))).toBe(false);
    expect(ownsArrowKeys(null)).toBe(false);
  });
});

describe('swipeStep', () => {
  const sample = { dx: -120, dy: 10, durationMs: 250, startX: 200, viewportWidth: 390 };

  it('swipe left → next, swipe right → previous', () => {
    expect(swipeStep(sample)).toBe('next');
    expect(swipeStep({ ...sample, dx: 120 })).toBe('previous');
  });

  it('needs enough horizontal travel', () => {
    expect(swipeStep({ ...sample, dx: -(SWIPE.minDistance - 1) })).toBeNull();
    expect(swipeStep({ ...sample, dx: -SWIPE.minDistance })).toBe('next');
  });

  it('leaves mostly vertical gestures to scrolling', () => {
    expect(swipeStep({ ...sample, dx: -80, dy: 60 })).toBeNull();
    expect(swipeStep({ ...sample, dx: -100, dy: -60 })).toBe('next');
  });

  it('ignores slow drags and gestures from the screen edges (OS Back)', () => {
    expect(swipeStep({ ...sample, durationMs: SWIPE.maxDurationMs + 1 })).toBeNull();
    expect(swipeStep({ ...sample, startX: 10, dx: 150 })).toBeNull();
    expect(swipeStep({ ...sample, startX: 385, dx: -150 })).toBeNull();
  });
});
