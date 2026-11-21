import { CONFIGURATOR_STEPS, type ConfiguratorStepId } from '../configurator-steps';
import { safeStorage } from '../storage';
import { canEnterStep, sanitizeDraft, type ConfiguratorDraft } from './draft';
import type { ConfiguratorModel } from './model';

/**
 * Configurator draft persistence (BRIEF: draft in localStorage with
 * try/catch). Goes through `safeStorage`, which never throws: in private
 * mode or with blocked storage the wizard simply works without persistence.
 */

/** Bump the version when the stored shape changes; older drafts are ignored. */
export const CONFIGURATOR_STORAGE_KEY = 'kabaninno.configurator.v1';

export interface StoredConfigurator {
  v: 1;
  step: ConfiguratorStepId;
  draft: ConfiguratorDraft;
}

export interface LoadedConfigurator {
  draft: ConfiguratorDraft;
  step: ConfiguratorStepId;
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
  const stored = value as Partial<StoredConfigurator>;
  if (stored.v !== 1) return null;
  const draft = sanitizeDraft(stored.draft, model);
  let step: ConfiguratorStepId = isStep(stored.step) ? stored.step : 'type';
  while (!canEnterStep(step, draft, model)) {
    step = CONFIGURATOR_STEPS[CONFIGURATOR_STEPS.indexOf(step) - 1] ?? 'type';
  }
  return { draft, step };
}

export function loadConfigurator(model: ConfiguratorModel): LoadedConfigurator | null {
  return readStoredConfigurator(safeStorage.getJSON(CONFIGURATOR_STORAGE_KEY), model);
}

export function saveConfigurator(draft: ConfiguratorDraft, step: ConfiguratorStepId): boolean {
  const stored: StoredConfigurator = { v: 1, step, draft };
  return safeStorage.setJSON(CONFIGURATOR_STORAGE_KEY, stored);
}

export function clearConfigurator(): void {
  safeStorage.remove(CONFIGURATOR_STORAGE_KEY);
}
