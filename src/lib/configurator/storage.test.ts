import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDraft, type ConfiguratorDraft } from './draft';
import { getConfiguratorModel } from './model';
import {
  CONFIGURATOR_STORAGE_KEY,
  clearConfigurator,
  loadConfigurator,
  readStoredConfigurator,
  saveConfigurator,
} from './storage';

const model = getConfiguratorModel();
let data: Map<string, string>;

function stubStorage(overrides: Partial<Storage> = {}) {
  data = new Map();
  vi.stubGlobal('window', {
    localStorage: {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      key: (index: number) => [...data.keys()][index] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
      ...overrides,
    } satisfies Storage,
  });
}

const draft: ConfiguratorDraft = {
  ...emptyDraft(),
  goals: ['more-clients'],
  answers: { 'more-clients': 'social-ads' },
  have: ['social'],
  industry: 'food',
};

beforeEach(() => stubStorage());
afterEach(() => vi.unstubAllGlobals());

describe('configurator storage', () => {
  it('round-trips the draft and the step under a versioned key', () => {
    expect(saveConfigurator(draft, 'details')).toBe(true);
    expect(JSON.parse(data.get(CONFIGURATOR_STORAGE_KEY)!)).toMatchObject({
      v: 2,
      step: 'details',
    });
    expect(loadConfigurator(model)).toEqual({ draft, step: 'details', message: null });
  });

  it('round-trips the edited message with its base (Q-F3-05)', () => {
    const draft = { ...emptyDraft(), goals: ['booking'] };
    const message = { text: 'Mój tekst', base: 'Domyślny tekst' };
    expect(saveConfigurator(draft, 'goals', message)).toBe(true);
    expect(loadConfigurator(model)?.message).toEqual(message);
    expect(
      readStoredConfigurator({ v: 2, step: 'goals', draft, message: 'x' }, model)?.message,
    ).toBeNull();
    clearConfigurator();
    expect(loadConfigurator(model)).toBeNull();
  });

  it('ignores other versions, garbage and corrupted JSON', () => {
    // The v1 draft of the old seven-step form is not migrated (D149).
    expect(readStoredConfigurator({ v: 1, step: 'type', draft }, model)).toBeNull();
    expect(readStoredConfigurator({ v: 3, step: 'goals', draft }, model)).toBeNull();
    expect(readStoredConfigurator('draft', model)).toBeNull();
    data.set(CONFIGURATOR_STORAGE_KEY, '{not json');
    expect(loadConfigurator(model)).toBeNull();
  });

  it('drops stale ids and moves the step back to the last enterable one', () => {
    const loaded = readStoredConfigurator(
      {
        v: 2,
        step: 'contact',
        draft: { ...draft, added: ['web/removed'], budget: 'gone' },
      },
      model,
    );
    expect(loaded?.draft.added).toEqual([]);
    expect(loaded?.draft.budget).toBeNull();
    // The cleared budget makes the plan step the furthest the visitor may enter.
    expect(loaded?.step).toBe('plan');
  });

  it('falls back to the first step for an unknown step id', () => {
    expect(readStoredConfigurator({ v: 2, step: 'nope', draft }, model)?.step).toBe('goals');
  });

  it('a stored manual draft never lands on the details step', () => {
    const manual = { ...emptyDraft(), mode: 'manual', added: ['web/landing-pages'] };
    expect(readStoredConfigurator({ v: 2, step: 'details', draft: manual }, model)?.step).toBe(
      'goals',
    );
    expect(readStoredConfigurator({ v: 2, step: 'plan', draft: manual }, model)?.step).toBe('plan');
  });

  it('works without storage (private mode, blocked access)', () => {
    stubStorage({
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(saveConfigurator(draft, 'goals')).toBe(false);
    expect(loadConfigurator(model)).toBeNull();
    expect(() => clearConfigurator()).not.toThrow();
  });
});
