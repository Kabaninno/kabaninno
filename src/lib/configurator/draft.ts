import { z } from 'zod';
import {
  CONFIGURATOR_STEPS,
  stepsFor,
  type ConfiguratorMode,
  type ConfiguratorStepId,
} from '../configurator-steps';
import {
  GOAL_UNSURE,
  HAVE_NONE,
  budgetIds,
  findGoal,
  findService,
  type ConfiguratorModel,
} from './model';
import { selectedServices } from './recommend';

/**
 * The configurator draft (D149): what the visitor chose so far, as ids from
 * the model. Pure helpers only; persistence is in `storage.ts`, the message in
 * `message.ts`, the recommendation in `recommend.ts`.
 *
 * The services are not stored as one list. The recommendation is derived from
 * the goals and answers, so changing an answer re-derives it; the visitor's own
 * changes are kept apart: `removed` (recommended ones they dropped) and `added`
 * (ones they picked, from a planet page, "Add more" or the manual mode).
 */

/** Longest "other industry" text, in characters. */
export const INDUSTRY_OTHER_MAX = 60;

export const configuratorDraftSchema = z.object({
  mode: z.enum(['guided', 'manual']),
  /** Step 1: goal ids (up to `model.maxGoals`), or just `GOAL_UNSURE`. */
  goals: z.array(z.string()),
  /** Step 2: the chosen option id per goal id. */
  answers: z.record(z.string(), z.string()),
  /** Step 2: what the visitor already has (`have` ids; `HAVE_NONE` is exclusive). */
  have: z.array(z.string()),
  /** Step 3: recommended services the visitor dropped. */
  removed: z.array(z.string()),
  /** Step 3: services the visitor picked (`"<category>/<slug>"`). */
  added: z.array(z.string()),
  /** Step 4: an industry id (optional); `other` comes with free text. */
  industry: z.string().nullable(),
  industryOther: z.string(),
  /** Step 4: a budget range id or `BUDGET_NOT_SURE`. */
  budget: z.string().nullable(),
  /** Step 4. */
  timeline: z.string().nullable(),
  /** Step 5. */
  contact: z.object({ name: z.string(), comment: z.string() }),
});

export type ConfiguratorDraft = z.infer<typeof configuratorDraftSchema>;

export function emptyDraft(): ConfiguratorDraft {
  return {
    mode: 'guided',
    goals: [],
    answers: {},
    have: [],
    removed: [],
    added: [],
    industry: null,
    industryOther: '',
    budget: null,
    timeline: null,
    contact: { name: '', comment: '' },
  };
}

/** Validation error codes (labels: `configurator.errors.<code>`). */
export type FieldError = 'required' | 'tooShort' | 'tooLong' | 'unknown';
/** Errors by field path, e.g. `{ "answers.booking": "required" }`; empty = valid. */
export type StepErrors = Partial<Record<string, FieldError>>;

/** Length in user-perceived characters (code points; good enough for limits). */
function length(text: string): number {
  return Array.from(text).length;
}

/** The services the draft is about (`selectedServices`). */
export function servicesOf(draft: ConfiguratorDraft, model: ConfiguratorModel): string[] {
  return selectedServices(model, draft);
}

/** Validates one step of the draft. Pure; returns `{}` when the step is valid. */
export function validateStep(
  step: ConfiguratorStepId,
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): StepErrors {
  const errors: StepErrors = {};
  switch (step) {
    case 'goals': {
      if (draft.mode === 'manual') break;
      const unsure = draft.goals.includes(GOAL_UNSURE);
      const known = draft.goals.every(
        (id) => id === GOAL_UNSURE || findGoal(model, id) !== undefined,
      );
      if (draft.goals.length === 0) errors.goals = 'required';
      else if (
        !known ||
        draft.goals.length > model.maxGoals ||
        (unsure && draft.goals.length > 1)
      ) {
        errors.goals = 'unknown';
      }
      break;
    }
    case 'details': {
      if (draft.mode === 'manual') break;
      for (const id of draft.goals) {
        const goal = findGoal(model, id);
        if (!goal) continue;
        const answer = draft.answers[id];
        if (answer === undefined) errors[`answers.${id}`] = 'required';
        else if (!goal.options.some((option) => option.id === answer)) {
          errors[`answers.${id}`] = 'unknown';
        }
      }
      if (draft.have.some((id) => !model.have.includes(id))) errors.have = 'unknown';
      break;
    }
    case 'solution':
      // Never blocks: no services means "let's pick together on a consultation".
      if (draft.added.some((id) => !findService(model, id))) errors.services = 'unknown';
      break;
    case 'plan': {
      const services = servicesOf(draft, model);
      if (draft.budget === null) errors.budget = 'required';
      else if (!budgetIds(model, services).includes(draft.budget)) errors.budget = 'unknown';
      if (draft.timeline === null) errors.timeline = 'required';
      else if (!model.timelines.includes(draft.timeline)) errors.timeline = 'unknown';
      if (draft.industry !== null && !model.industries.includes(draft.industry)) {
        errors.industry = 'unknown';
      }
      if (length(draft.industryOther.trim()) > INDUSTRY_OTHER_MAX) errors.industry = 'tooLong';
      break;
    }
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
 * before it (in the draft's mode) is valid, so the progress indicator can jump
 * forward too.
 */
export function canEnterStep(
  step: ConfiguratorStepId,
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): boolean {
  const steps = stepsFor(draft.mode);
  const index = steps.indexOf(step);
  if (index < 0) return false;
  return steps.slice(0, index).every((before) => isStepValid(before, draft, model));
}

/** The step after (`delta` 1) or before (`delta` -1) this one in the draft's mode. */
export function neighbourStep(
  draft: Pick<ConfiguratorDraft, 'mode'>,
  step: ConfiguratorStepId,
  delta: 1 | -1,
): ConfiguratorStepId | undefined {
  const steps = stepsFor(draft.mode);
  return steps[steps.indexOf(step) + delta];
}

/** The step to show for a stored one: itself when the mode has it, else the first step. */
export function stepInMode(
  draft: Pick<ConfiguratorDraft, 'mode'>,
  step: ConfiguratorStepId,
): ConfiguratorStepId {
  return stepsFor(draft.mode).includes(step) ? step : CONFIGURATOR_STEPS[0];
}

/** The first step that is not valid yet, or `null` when the whole draft is. */
export function firstInvalidStep(
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): ConfiguratorStepId | null {
  return stepsFor(draft.mode).find((step) => !isStepValid(step, draft, model)) ?? null;
}

/** The furthest step the visitor may be on (resume after a reload). */
export function furthestEnterableStep(
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): ConfiguratorStepId {
  return firstInvalidStep(draft, model) ?? stepsFor(draft.mode).at(-1)!;
}

/* ------------------------------------------------------------------ */
/* Edits                                                               */
/* ------------------------------------------------------------------ */

/**
 * Clears the budget when the ranges offered for the current services no
 * longer include it (the complexity level moved, D138). "Not sure" always
 * stays. Returns the same draft when nothing changes.
 */
export function reconcileBudget(
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  if (draft.budget === null) return draft;
  if (budgetIds(model, servicesOf(draft, model)).includes(draft.budget)) return draft;
  return { ...draft, budget: null };
}

/**
 * Selects / deselects a goal and switches to the guided mode. "Not sure" is
 * exclusive: picking it clears the other goals, picking another goal clears it.
 * At most `model.maxGoals` goals; the answer of a deselected goal is dropped.
 * Unknown ids are ignored.
 */
export function toggleGoal(
  draft: ConfiguratorDraft,
  id: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  if (id !== GOAL_UNSURE && !findGoal(model, id)) return draft;
  let goals: string[];
  if (draft.goals.includes(id)) goals = draft.goals.filter((goal) => goal !== id);
  else if (id === GOAL_UNSURE) goals = [GOAL_UNSURE];
  else {
    const others = draft.goals.filter((goal) => goal !== GOAL_UNSURE);
    if (others.length >= model.maxGoals) return draft;
    goals = [...others, id];
  }
  const answers = Object.fromEntries(
    Object.entries(draft.answers).filter(([goal]) => goals.includes(goal)),
  );
  return reconcileBudget({ ...draft, mode: 'guided', goals, answers }, model);
}

/** Answers a goal's question. Unknown goals (not selected) and options are ignored. */
export function setAnswer(
  draft: ConfiguratorDraft,
  goalId: string,
  optionId: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  const goal = findGoal(model, goalId);
  if (!goal || !draft.goals.includes(goalId)) return draft;
  if (!goal.options.some((option) => option.id === optionId)) return draft;
  return reconcileBudget({ ...draft, answers: { ...draft.answers, [goalId]: optionId } }, model);
}

/** Toggles an item of "What do you already have?"; "nothing of these" is exclusive. */
export function toggleHave(
  draft: ConfiguratorDraft,
  id: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  if (!model.have.includes(id)) return draft;
  let have: string[];
  if (draft.have.includes(id)) have = draft.have.filter((item) => item !== id);
  else if (id === HAVE_NONE) have = [HAVE_NONE];
  else have = [...draft.have.filter((item) => item !== HAVE_NONE), id];
  return { ...draft, have: model.have.filter((item) => have.includes(item)) };
}

/** "I know what I need": the manual mode; goals and answers go, picked services stay. */
export function chooseManual(
  draft: ConfiguratorDraft,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  return reconcileBudget({ ...draft, mode: 'manual', goals: [], answers: {}, removed: [] }, model);
}

/** Back to the guided mode (the goals step); picked services stay. */
export function chooseGuided(draft: ConfiguratorDraft): ConfiguratorDraft {
  return { ...draft, mode: 'guided' };
}

/** Drops a service from the request, whether it was recommended or picked. Unknown ids are ignored. */
export function removeService(
  draft: ConfiguratorDraft,
  id: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  if (!findService(model, id)) return draft;
  const removed = draft.removed.includes(id) ? draft.removed : [...draft.removed, id];
  return reconcileBudget(
    { ...draft, removed, added: draft.added.filter((item) => item !== id) },
    model,
  );
}

/** Adds a service to the request (it stops being "removed"). Unknown ids are ignored. */
export function addService(
  draft: ConfiguratorDraft,
  id: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  if (!findService(model, id)) return draft;
  return reconcileBudget(
    {
      ...draft,
      removed: draft.removed.filter((item) => item !== id),
      added: draft.added.includes(id) ? draft.added : [...draft.added, id],
    },
    model,
  );
}

/** Adds or drops a service, depending on whether the request has it now. */
export function toggleService(
  draft: ConfiguratorDraft,
  id: string,
  model: ConfiguratorModel,
): ConfiguratorDraft {
  return servicesOf(draft, model).includes(id)
    ? removeService(draft, id, model)
    : addService(draft, id, model);
}

/* ------------------------------------------------------------------ */
/* Sanitising (stored drafts) and prefill                              */
/* ------------------------------------------------------------------ */

const looseDraftSchema = z
  .object({
    mode: z.unknown(),
    goals: z.array(z.unknown()).catch([]),
    answers: z.record(z.string(), z.unknown()).catch({}),
    have: z.array(z.unknown()).catch([]),
    removed: z.array(z.unknown()).catch([]),
    added: z.array(z.unknown()).catch([]),
    industry: z.unknown(),
    industryOther: z.unknown(),
    budget: z.unknown(),
    timeline: z.unknown(),
    contact: z.object({ name: z.unknown(), comment: z.unknown() }).partial().catch({}),
  })
  .partial();

const pick = (value: unknown, allowed: readonly string[]): string | null =>
  typeof value === 'string' && allowed.includes(value) ? value : null;
const clip = (value: unknown, max: number): string =>
  typeof value === 'string' ? Array.from(value).slice(0, max).join('') : '';
const strings = (values: readonly unknown[] | undefined): string[] =>
  (values ?? []).filter((value): value is string => typeof value === 'string');

/**
 * Turns anything (a stored draft from an older build, hand-edited storage)
 * into a valid draft shape: unknown or stale ids are dropped, wrong types
 * become empty, texts are clipped to their limits. Never throws.
 */
export function sanitizeDraft(raw: unknown, model: ConfiguratorModel): ConfiguratorDraft {
  const parsed = looseDraftSchema.safeParse(raw);
  if (!parsed.success) return emptyDraft();
  const value = parsed.data;
  const mode: ConfiguratorMode = value.mode === 'manual' ? 'manual' : 'guided';

  let goals = [...new Set(strings(value.goals))].filter(
    (id) => id === GOAL_UNSURE || findGoal(model, id) !== undefined,
  );
  if (goals.includes(GOAL_UNSURE)) goals = [GOAL_UNSURE];
  goals = goals.slice(0, model.maxGoals);
  if (mode === 'manual') goals = [];
  const answers: Record<string, string> = {};
  for (const id of goals) {
    const option = findGoal(model, id)?.options.find((item) => item.id === value.answers?.[id]);
    if (option) answers[id] = option.id;
  }

  let have = model.have.filter((id) => strings(value.have).includes(id));
  if (have.includes(HAVE_NONE)) have = [HAVE_NONE];

  const services = (ids: readonly unknown[] | undefined) => [
    ...new Set(strings(ids).filter((id) => findService(model, id) !== undefined)),
  ];
  const removed = mode === 'manual' ? [] : services(value.removed);
  const added = services(value.added);

  const industry = pick(value.industry, model.industries);
  const contact = value.contact ?? {};
  const draft: ConfiguratorDraft = {
    mode,
    goals,
    answers,
    have,
    removed,
    added,
    industry,
    industryOther: industry === 'other' ? clip(value.industryOther, INDUSTRY_OTHER_MAX) : '',
    budget: null,
    timeline: pick(value.timeline, model.timelines),
    contact: {
      name: clip(contact.name, model.limits.nameMax),
      comment: clip(contact.comment, model.limits.commentMax),
    },
  };
  return { ...draft, budget: pick(value.budget, budgetIds(model, servicesOf(draft, model))) };
}

/**
 * Prefill from «Add to request» (D66 request refs and the `?add=` query):
 * each known service ref `"<category>/<slug>"` becomes a picked service.
 * Unknown refs are ignored.
 */
export function prefillDraft(
  draft: ConfiguratorDraft,
  refs: readonly string[],
  model: ConfiguratorModel,
): ConfiguratorDraft {
  let next = draft;
  for (const ref of refs) {
    if (!findService(model, ref) || next.added.includes(ref)) continue;
    next = addService(next, ref, model);
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
