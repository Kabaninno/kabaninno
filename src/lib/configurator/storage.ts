import { CONFIGURATOR_STEPS, stepsFor, type ConfiguratorStepId } from '../configurator-steps';
import { safeStorage } from '../storage';
import { canEnterStep, sanitizeDraft, stepInMode, type ConfiguratorDraft } from './draft';
import type { ConfiguratorModel } from './model';
import { parseMessageEdit, type MessageEdit } from './session';

/**
 * Configurator draft persistence (BRIEF: draft in localStorage with
 * try/catch). Goes through `safeStorage`, which never throws: in private
 * mode or with blocked storage the wizard simply works without persistence.
 */

/**
 * Bump the version when the stored shape changes incompatibly. v2 (D149): the
 * diagnostic flow (goals, answers, picked services); the v1 drafts of the old
 * seven-step form are ignored. v3 (round 3, D155): the industry step first, no
 * budget and timeline; a v2 draft is migrated (its budget and timeline are
 * dropped, the removed budget step resumes on the solution step). The key
 * keeps its name, so a v2 draft is found.
 */
export const CONFIGURATOR_STORAGE_KEY = 'kabaninno.configurator.v2';

export const CONFIGURATOR_STORAGE_VERSION = 3;

export interface StoredConfigurator {
  v: typeof CONFIGURATOR_STORAGE_VERSION;
  step: ConfiguratorStepId;
  draft: ConfiguratorDraft;
  /** The visitor's edit of the summary message, with its base. */
  message?: MessageEdit;
}

export interface LoadedConfigurator {
  draft: ConfiguratorDraft;
  step: ConfiguratorStepId;
  message: MessageEdit | null;
}

function isStep(value: unknown): value is ConfiguratorStepId {
  return typeof value === 'string' && (CONFIGURATOR_STEPS as readonly string[]).includes(value);
}

/**
 * Reads the stored draft: anything unreadable or of another version yields
 * `null`; stale ids are dropped (`sanitizeDraft`); the step falls back to the
 * last one the sanitised draft may enter.
 */
export function readStoredConfigurator(
  value: unknown,
  model: ConfiguratorModel,
): LoadedConfigurator | null {
  if (value === null || typeof value !== 'object') return null;
  const stored = value as { v?: unknown; step?: unknown; draft?: unknown; message?: unknown };
  if (stored.v !== CONFIGURATOR_STORAGE_VERSION && stored.v !== 2) return null;
  const draft = sanitizeDraft(stored.draft, model);
  const steps = stepsFor(draft.mode);
  // v2 had a budget step between the solution and the contact.
  const storedStep = stored.v === 2 && stored.step === 'plan' ? 'solution' : stored.step;
  let step: ConfiguratorStepId = stepInMode(draft, isStep(storedStep) ? storedStep : steps[0]!);
  while (!canEnterStep(step, draft, model)) {
    step = steps[steps.indexOf(step) - 1] ?? steps[0]!;
  }
  return { draft, step, message: parseMessageEdit(stored.message) };
}

export function loadConfigurator(model: ConfiguratorModel): LoadedConfigurator | null {
  return readStoredConfigurator(safeStorage.getJSON(CONFIGURATOR_STORAGE_KEY), model);
}

export function saveConfigurator(
  draft: ConfiguratorDraft,
  step: ConfiguratorStepId,
  message: MessageEdit | null = null,
): boolean {
  const stored: StoredConfigurator = {
    v: CONFIGURATOR_STORAGE_VERSION,
    step,
    draft,
    ...(message ? { message } : {}),
  };
  return safeStorage.setJSON(CONFIGURATOR_STORAGE_KEY, stored);
}

export function clearConfigurator(): void {
  safeStorage.remove(CONFIGURATOR_STORAGE_KEY);
}
