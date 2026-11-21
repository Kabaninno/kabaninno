import { parentSceneState, routeToSceneState, sceneStateToPath } from './route-state';
import { withTrailingSlash } from './style';

/**
 * "Esc → back" (D27): what pressing Escape on a page does. Pure logic; the
 * DOM wiring lives in `components/layout/EscapeToParent.tsx`.
 *
 * - planet → system → universe; project → portfolio; portfolio and
 *   configurator → universe; the universe itself has no parent (no-op).
 * - When the previous session-history entry already is the parent page,
 *   going back is the natural move (Forward still works afterwards and no
 *   duplicate entry is created). Otherwise (deep link, the user came from
 *   elsewhere) the parent path is pushed.
 */
export type EscapeAction = { type: 'none' } | { type: 'back' } | { type: 'push'; path: string };

/**
 * @param pathname     current locale-less pathname (next-intl `usePathname()`)
 * @param locale       current locale
 * @param previousPath pathname of the previous history entry with the base
 *                     path already stripped (e.g. "/pl/services/web/"), or
 *                     null when unknown (no Navigation API, first entry…)
 */
export function escapeAction(
  pathname: string,
  locale: string,
  previousPath: string | null,
): EscapeAction {
  const target = routeToSceneState(pathname);
  if (target.mode === 'universe' || target.mode === 'unknown') return { type: 'none' };
  const parentPath = sceneStateToPath(parentSceneState(target));
  const localizedParent = `/${locale}${parentPath}`;
  if (previousPath !== null && withTrailingSlash(previousPath) === localizedParent) {
    return { type: 'back' };
  }
  return { type: 'push', path: parentPath };
}

/** The bits of a `KeyboardEvent` the Esc guard looks at (plain objects in tests). */
export interface EscapeKeyLike {
  key: string;
  defaultPrevented: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface EscapeContext {
  /** The event comes from a text field, select or contenteditable element. */
  editableTarget: boolean;
  /** A modal dialog (mobile menu, future sheets) is open and owns Esc. */
  dialogOpen: boolean;
}

/**
 * Whether a keydown should trigger "Esc → back". Ignored when another layer
 * already consumed it (`defaultPrevented`, D27: e.g. the Services menu
 * closing), while typing (IME composition, inputs), with modifier keys, on
 * auto-repeat (holding Esc must not climb several levels) and while a dialog
 * is open (the browser closes the dialog instead).
 */
export function shouldHandleEscape(event: EscapeKeyLike, context: EscapeContext): boolean {
  if (event.key !== 'Escape' && event.key !== 'Esc') return false;
  if (event.defaultPrevented || event.repeat || event.isComposing) return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  return !context.editableTarget && !context.dialogOpen;
}

/** Minimal element shape for `isEditableElement` (DOM elements or test doubles). */
export interface EditableCandidate {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

const TEXT_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);

/** Text inputs, textareas, selects, contenteditable hosts and ARIA text widgets. */
export function isEditableElement(element: EditableCandidate | null | undefined): boolean {
  if (!element) return false;
  const tag = element.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (element.isContentEditable) return true;
  const role = element.getAttribute?.('role');
  return role ? TEXT_ROLES.has(role) : false;
}
