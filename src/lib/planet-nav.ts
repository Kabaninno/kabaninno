/**
 * Switching between neighbouring planets (BRIEF scene 2, D16): ←/→ keys and
 * a horizontal swipe on the panel / bottom sheet. Pure logic; the DOM wiring
 * lives in `components/panel/PanelSiblings.ts`. Navigation itself uses
 * `router.replace`, so Back still returns to the system.
 */
export type PlanetStep = 'previous' | 'next';

/** The bits of a `KeyboardEvent` the guard looks at (plain objects in tests). */
export interface PlanetKeyLike {
  key: string;
  defaultPrevented: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface PlanetKeyContext {
  /** The key comes from a text field, select or other widget that owns arrows. */
  ownsArrows: boolean;
  /** A dialog or an expanded menu (Services) is open. */
  overlayOpen: boolean;
}

/**
 * ← / → → previous / next planet. Ignored when another handler consumed the
 * key, on auto-repeat (holding the key must not race through the system),
 * during IME composition, with any modifier (Alt+← is browser Back), inside
 * widgets that use arrows themselves, and while a dialog or menu is open.
 */
export function planetKeyStep(event: PlanetKeyLike, context: PlanetKeyContext): PlanetStep | null {
  const step = event.key === 'ArrowRight' ? 'next' : event.key === 'ArrowLeft' ? 'previous' : null;
  if (step === null) return null;
  if (event.defaultPrevented || event.repeat || event.isComposing) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (context.ownsArrows || context.overlayOpen) return null;
  return step;
}

/** ARIA roles whose widgets handle arrow keys themselves. */
const ARROW_ROLES = new Set([
  'slider',
  'spinbutton',
  'listbox',
  'option',
  'menu',
  'menubar',
  'menuitem',
  'menuitemradio',
  'menuitemcheckbox',
  'radio',
  'radiogroup',
  'tab',
  'tablist',
  'tree',
  'treeitem',
  'grid',
  'gridcell',
  'textbox',
  'searchbox',
  'combobox',
]);

/** Minimal element shape (DOM elements or test doubles). */
export interface ArrowCandidate {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

/** Form fields, contenteditable hosts and ARIA widgets that use arrow keys. */
export function ownsArrowKeys(element: ArrowCandidate | null | undefined): boolean {
  if (!element) return false;
  const tag = element.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (element.isContentEditable) return true;
  const role = element.getAttribute?.('role');
  return role ? ARROW_ROLES.has(role) : false;
}

/** Thresholds of a planet swipe on the panel / bottom sheet. */
export const SWIPE = {
  /** Minimum horizontal travel, CSS px. */
  minDistance: 56,
  /** Horizontal travel must exceed the vertical one by this factor. */
  ratio: 1.6,
  /** Slower drags are reading / scrolling, not swipes. */
  maxDurationMs: 700,
  /** Gestures starting this close to a screen edge belong to the OS (iOS Back). */
  edgePx: 24,
} as const;

export interface SwipeSample {
  dx: number;
  dy: number;
  durationMs: number;
  startX: number;
  viewportWidth: number;
}

/**
 * A finished touch gesture → planet step. Swipe left = next, swipe right =
 * previous (the content moves with the finger). Mostly vertical gestures are
 * left to the sheet's own scrolling, so the two never fight.
 */
export function swipeStep({
  dx,
  dy,
  durationMs,
  startX,
  viewportWidth,
}: SwipeSample): PlanetStep | null {
  if (startX < SWIPE.edgePx || startX > viewportWidth - SWIPE.edgePx) return null;
  if (durationMs > SWIPE.maxDurationMs) return null;
  if (Math.abs(dx) < SWIPE.minDistance) return null;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE.ratio) return null;
  return dx < 0 ? 'next' : 'previous';
}
