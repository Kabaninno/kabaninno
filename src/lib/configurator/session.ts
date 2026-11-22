import type { ConfiguratorStepId } from '../configurator-steps';
import { sceneNodeId } from '@/scene/node-ids';
import { prefillDraft, emptyDraft, servicesOf, type ConfiguratorDraft } from './draft';
import type { ConfiguratorModel } from './model';
import { categoriesOf } from './recommend';

/**
 * Glue between the wizard, the request draft (D66) and the scene (D81).
 * Pure; the wizard component calls these.
 */

/**
 * Scene emphasis for the draft (D81): the categories of the services the
 * request is about so far, so the universe answers the visitor's answers.
 */
export function emphasisForDraft(draft: ConfiguratorDraft, model: ConfiguratorModel): string[] {
  return categoriesOf(model, servicesOf(draft, model)).map((type) => sceneNodeId.category(type));
}

/**
 * Service refs the request draft mirrors: the services the visitor picked
 * themselves (planet pages, "Add more", manual mode), not the recommended
 * ones, which follow the answers and are not "added to the request".
 */
export function serviceRefsOf(draft: Pick<ConfiguratorDraft, 'added'>): string[] {
  return draft.added;
}

/** What the wizard starts with. */
export interface StartingState {
  draft: ConfiguratorDraft;
  step: ConfiguratorStepId;
  message: MessageEdit | null;
  /** Refs that were not picked before (the "already selected" notice). */
  added: string[];
}

/**
 * The state the wizard starts with: the stored one (or an empty draft on the
 * first step) plus the services from the request draft and the `?add=` query.
 * Idempotent: the request draft mirrors the wizard's picked services, so a
 * service dropped in the wizard is gone from the request too and does not come
 * back on the next visit.
 *
 * A visitor who arrives with services picked on the planet pages and has not
 * answered any goal knows what they want: they continue in the manual mode, on
 * the solution step (D150).
 */
export function startingState(
  stored: {
    draft: ConfiguratorDraft;
    step: ConfiguratorStepId;
    message: MessageEdit | null;
  } | null,
  refs: readonly string[],
  model: ConfiguratorModel,
): StartingState {
  const base = stored?.draft ?? emptyDraft();
  const draft = prefillDraft(base, refs, model);
  const added = draft.added.filter((id) => !base.added.includes(id));
  let step: ConfiguratorStepId = stored?.step ?? 'goals';
  let next = draft;
  if (added.length > 0 && base.goals.length === 0 && step === 'goals') {
    next = { ...draft, mode: 'manual' };
    step = 'solution';
  }
  return { draft: next, step, message: stored?.message ?? null, added };
}

/** What the request draft must change to mirror the wizard's picked services. */
export function requestSync(
  previous: Pick<ConfiguratorDraft, 'added'>,
  next: Pick<ConfiguratorDraft, 'added'>,
): { add: string[]; remove: string[] } {
  const before = serviceRefsOf(previous);
  const after = serviceRefsOf(next);
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
