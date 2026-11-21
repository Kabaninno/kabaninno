import { z } from 'zod';
import { CONFIGURATOR_STEPS, type ConfiguratorStepId } from '../configurator-steps';
import { budgetIds, findFeature, type ConfiguratorModel } from './model';

/**
 * The configurator draft (BRIEF «Конфігуратор запиту»): what the visitor
 * chose so far, as ids from the model. Pure helpers only; persistence is in
 * `storage.ts`, the message in `message.ts`.
 */

export const yesNoSchema = z.enum(['yes', 'no']);

export const configuratorDraftSchema = z.object({
  /** Step 1: category ids (multi-select). */
  types: z.array(z.string()),
  /** Step 2: feature ids `"<category>/<key>"` of the selected categories. */
  features: z.array(z.string()),
  /** Step 3. */
  business: z.object({
    industry: z.string().nullable(),
    size: z.string().nullable(),
    hasWebsite: yesNoSchema.nullable(),
    hasCrm: yesNoSchema.nullable(),
  }),
  /** Step 4: a budget range id or `BUDGET_NOT_SURE`. */
  budget: z.string().nullable(),
  /** Step 5. */
  timeline: z.string().nullable(),
  /** Step 6. */
  contact: z.object({ name: z.string(), comment: z.string() }),
});

export type ConfiguratorDraft = z.infer<typeof configuratorDraftSchema>;

export function emptyDraft(): ConfiguratorDraft {
  return {
    types: [],
    features: [],
    business: { industry: null, size: null, hasWebsite: null, hasCrm: null },
    budget: null,
    timeline: null,
    contact: { name: '', comment: '' },
  };
}

/** Validation error codes (labels: `configurator.errors.<code>`). */
export type FieldError = 'required' | 'tooShort' | 'tooLong' | 'unknown';
/** Errors by field path, e.g. `{ "business.industry": "required" }`; empty = valid. */
export type StepErrors = Partial<Record<string, FieldError>>;

/** Length in user-perceived characters (code points; good enough for limits). */
function length(text: string): number {
  return Array.from(text).length;
}

/** Validates one step of the draft. Pure; returns `{}` when the step is valid. */
export function validateStep(
  step: ConfiguratorStepId,
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): StepErrors {
  const errors: StepErrors = {};
  switch (step) {
    case 'type':
      if (draft.types.length === 0) errors.types = 'required';
      else if (draft.types.some((type) => !model.types.includes(type))) errors.types = 'unknown';
      break;
    case 'features': {
      const selected = draft.features.filter((id) => draft.types.includes(id.split('/')[0] ?? ''));
      if (selected.length === 0) errors.features = 'required';
      else if (draft.features.some((id) => !findFeature(model, id))) errors.features = 'unknown';
      break;
    }
    case 'business': {
      const { industry, size, hasWebsite, hasCrm } = draft.business;
      if (industry === null) errors['business.industry'] = 'required';
      else if (!model.industries.includes(industry)) errors['business.industry'] = 'unknown';
      if (size === null) errors['business.size'] = 'required';
      else if (!model.companySizes.includes(size)) errors['business.size'] = 'unknown';
      if (hasWebsite === null) errors['business.hasWebsite'] = 'required';
      if (hasCrm === null) errors['business.hasCrm'] = 'required';
      break;
    }
    case 'budget':
      if (draft.budget === null) errors.budget = 'required';
      else if (!budgetIds(model).includes(draft.budget)) errors.budget = 'unknown';
      break;
    case 'timeline':
      if (draft.timeline === null) errors.timeline = 'required';
      else if (!model.timelines.includes(draft.timeline)) errors.timeline = 'unknown';
      break;
    case 'contact': {
      const name = length(draft.contact.name.trim());
      if (name === 0) errors['contact.name'] = 'required';
      else if (name < model.limits.nameMin) errors['contact.name'] = 'tooShort';
      else if (name > model.limits.nameMax) errors['contact.name'] = 'tooLong';
      if (length(draft.contact.comment.trim()) > model.limits.commentMax) {
        errors['contact.comment'] = 'tooLong';
      }
      break;
    }
    case 'summary':
      break;
  }
  return errors;
}

export function isStepValid(
  step: ConfiguratorStepId,
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): boolean {
  return Object.keys(validateStep(step, draft, model)).length === 0;
}

/**
 * Any earlier step is always reachable; a step is enterable once every step
 * before it is valid (so the progress indicator can jump forward too).
 */
export function canEnterStep(
  step: ConfiguratorStepId,
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): boolean {
  const index = CONFIGURATOR_STEPS.indexOf(step);
  return CONFIGURATOR_STEPS.slice(0, index).every((before) => isStepValid(before, draft, model));
}

/** The first step that is not valid yet, or `null` when the whole draft is (summary included). */
export function firstInvalidStep(
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): ConfiguratorStepId | null {
  return CONFIGURATOR_STEPS.find((step) => !isStepValid(step, draft, model)) ?? null;
}

/** The furthest step the visitor may be on (resume after a reload). */
export function furthestEnterableStep(
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): ConfiguratorStepId {
  return firstInvalidStep(draft, model) ?? 'summary';
}

/* ------------------------------------------------------------------ */
/* Edits                                                               */
/* ------------------------------------------------------------------ */

/** Keeps only features of selected categories (after the types change). */
function pruneFeatures(draft: ConfiguratorDraft): ConfiguratorDraft {
  return {
    ...draft,
    features: draft.features.filter((id) => draft.types.includes(id.split('/')[0] ?? '')),
  };
}

/** Selects / deselects a category (deselecting drops its features). Unknown ids are ignored. */
export function toggleType(
  draft: ConfiguratorDraft,
  type: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  if (!model.types.includes(type)) return draft;
  const types = draft.types.includes(type)
    ? draft.types.filter((item) => item !== type)
    : model.types.filter((item) => item === type || draft.types.includes(item));
  return pruneFeatures({ ...draft, types });
}

/** Selects / deselects a feature of a selected category. Unknown or unselected ones are ignored. */
export function toggleFeature(
  draft: ConfiguratorDraft,
  id: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  const feature = findFeature(model, id);
  if (!feature || !draft.types.includes(feature.category)) return draft;
  const features = draft.features.includes(id)
    ? draft.features.filter((item) => item !== id)
    : [...draft.features, id];
  return { ...draft, features };
}

/* ------------------------------------------------------------------ */
/* Sanitising (stored drafts) and prefill                              */
/* ------------------------------------------------------------------ */

const looseDraftSchema = z
  .object({
    types: z.array(z.unknown()).catch([]),
    features: z.array(z.unknown()).catch([]),
    business: z
      .object({
        industry: z.unknown(),
        size: z.unknown(),
        hasWebsite: z.unknown(),
        hasCrm: z.unknown(),
      })
      .partial()
      .catch({}),
    budget: z.unknown(),
    timeline: z.unknown(),
    contact: z.object({ name: z.unknown(), comment: z.unknown() }).partial().catch({}),
  })
  .partial();

const pick = (value: unknown, allowed: readonly string[]): string | null =>
  typeof value === 'string' && allowed.includes(value) ? value : null;
const yesNo = (value: unknown) => (value === 'yes' || value === 'no' ? value : null);
const clip = (value: unknown, max: number): string =>
  typeof value === 'string' ? Array.from(value).slice(0, max).join('') : '';

/**
 * Turns anything (a stored draft from an older build, hand-edited storage)
 * into a valid draft shape: unknown or stale ids are dropped, wrong types
 * become empty, texts are clipped to their limits. Never throws.
 */
export function sanitizeDraft(raw: unknown, model: ConfiguratorModel): ConfiguratorDraft {
  const parsed = looseDraftSchema.safeParse(raw);
  if (!parsed.success) return emptyDraft();
  const value = parsed.data;
  const types = model.types.filter((type) => (value.types ?? []).includes(type));
  const features = [
    ...new Set(
      (value.features ?? []).filter(
        (id): id is string =>
          typeof id === 'string' &&
          findFeature(model, id) !== undefined &&
          types.includes(id.split('/')[0] ?? ''),
      ),
    ),
  ];
  const business = value.business ?? {};
  const contact = value.contact ?? {};
  return {
    types,
    features,
    business: {
      industry: pick(business.industry, model.industries),
      size: pick(business.size, model.companySizes),
      hasWebsite: yesNo(business.hasWebsite),
      hasCrm: yesNo(business.hasCrm),
    },
    budget: pick(value.budget, budgetIds(model)),
    timeline: pick(value.timeline, model.timelines),
    contact: {
      name: clip(contact.name, model.limits.nameMax),
      comment: clip(contact.comment, model.limits.commentMax),
    },
  };
}

/**
 * Prefill from «Add to request» (D66 request refs and the `?add=` query):
 * each known service ref `"<category>/<slug>"` selects its category and the
 * service feature. Unknown refs and extra-feature ids are ignored.
 */
export function prefillDraft(
  draft: ConfiguratorDraft,
  refs: readonly string[],
  model: ConfiguratorModel,
): ConfiguratorDraft {
  let next = draft;
  for (const ref of refs) {
    const feature = findFeature(model, ref);
    if (!feature || feature.kind !== 'service') continue;
    if (!next.types.includes(feature.category)) next = toggleType(next, feature.category, model);
    if (!next.features.includes(ref)) next = toggleFeature(next, ref, model);
  }
  return next;
}

/** Service refs from the `?add=` query (repeated and/or comma-separated). */
export function refsFromSearch(search: string | URLSearchParams): string[] {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const refs = params
    .getAll('add')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(refs)];
}
