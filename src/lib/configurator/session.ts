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
