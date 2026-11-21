import { sceneNodeId } from '@/scene/node-ids';
import { prefillDraft, type ConfiguratorDraft } from './draft';
import { findFeature, type ConfiguratorModel } from './model';

/**
 * Glue between the wizard, the request draft (D66) and the scene (D81).
 * Pure; the wizard component calls these.
 */

/** Scene emphasis for the draft (D81): the selected solution types as category nodes. */
export function emphasisForDraft(draft: Pick<ConfiguratorDraft, 'types'>): string[] {
  return draft.types.map((type) => sceneNodeId.category(type));
}

/** Service refs selected in the draft (the request draft mirrors them). */
export function serviceRefsOf(draft: ConfiguratorDraft, model: ConfiguratorModel): string[] {
  return draft.features.filter((id) => findFeature(model, id)?.kind === 'service');
}

/**
 * The draft the wizard starts with: the stored one (or empty) plus the
 * services from the request draft and the `?add=` query. `added` lists the
 * refs that were not selected before, for the "already selected" notice.
 * Idempotent: the request draft mirrors the wizard's service choices, so a
 * service deselected in the wizard is gone from the request too and does not
 * come back on the next visit.
 */
export function startingDraft(
  base: ConfiguratorDraft,
  refs: readonly string[],
  model: ConfiguratorModel,
): { draft: ConfiguratorDraft; added: string[] } {
  const draft = prefillDraft(base, refs, model);
  const added = draft.features.filter((id) => !base.features.includes(id));
  return { draft, added };
}

/** What the request draft must change to mirror the wizard's services. */
export function requestSync(
  previous: ConfiguratorDraft,
  next: ConfiguratorDraft,
  model: ConfiguratorModel,
): { add: string[]; remove: string[] } {
  const before = serviceRefsOf(previous, model);
  const after = serviceRefsOf(next, model);
  return {
    add: after.filter((ref) => !before.includes(ref)),
    remove: before.filter((ref) => !after.includes(ref)),
  };
}

/**
 * The visitor's own version of the summary message, with the default text
 * it was based on (`base`). The default follows the answers; the edit does
 * not, so when the default changes after an edit, the edit is stale: the
 * summary says so and offers "Update message" / "Keep my text" (Q-F3-01).
 */
export interface MessageEdit {
  text: string;
  base: string;
}

/** Longest stored edit (characters); longer stored values are dropped. */
export const MESSAGE_EDIT_MAX = 10_000;

/** The text to show, copy and send. */
export function messageText(edit: MessageEdit | null, full: string): string {
  return edit?.text ?? full;
}

/** A new keystroke: keeps the base of an existing edit, else starts from the current default. */
export function editMessage(edit: MessageEdit | null, text: string, full: string): MessageEdit {
  return { text, base: edit?.base ?? full };
}

/** The answers changed after the edit, and the edit is not simply the new default. */
export function isEditStale(edit: MessageEdit | null, full: string): boolean {
  return edit !== null && edit.base !== full && edit.text !== full;
}

/** "Keep my text": the edit stays, now based on the current default (the notice goes). */
export function keepEdit(edit: MessageEdit, full: string): MessageEdit {
  return { text: edit.text, base: full };
}

/** A stored edit, or null when missing or malformed. */
export function parseMessageEdit(value: unknown): MessageEdit | null {
  if (!value || typeof value !== 'object') return null;
  const { text, base } = value as { text?: unknown; base?: unknown };
  if (typeof text !== 'string' || typeof base !== 'string') return null;
  if (text.length > MESSAGE_EDIT_MAX || base.length > MESSAGE_EDIT_MAX) return null;
  return { text, base };
}

/**
 * The current URL without the `?add=` prefill (Q-F3-02): once applied, the
 * services live in the draft and the request; keeping the parameter would
 * re-add a service the visitor deselected on every reload or Back. Other
 * parameters and the hash stay. Returns null when there is nothing to remove.
 */
export function urlWithoutPrefill(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has('add')) return null;
  url.searchParams.delete('add');
  return `${url.pathname}${url.search}${url.hash}`;
}
