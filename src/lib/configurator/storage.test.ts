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
  types: ['web'],
  features: ['web/landing-pages'],
  business: { industry: 'food', size: 'solo', hasWebsite: 'no', hasCrm: 'no' },
};

beforeEach(() => stubStorage());
afterEach(() => vi.unstubAllGlobals());

describe('configurator storage', () => {
  it('round-trips the draft and the step under a versioned key', () => {
    expect(saveConfigurator(draft, 'budget')).toBe(true);
    expect(JSON.parse(data.get(CONFIGURATOR_STORAGE_KEY)!)).toMatchObject({ v: 1, step: 'budget' });
    expect(loadConfigurator(model)).toEqual({ draft, step: 'budget' });
    clearConfigurator();
    expect(loadConfigurator(model)).toBeNull();
  });

  it('ignores other versions, garbage and corrupted JSON', () => {
    expect(readStoredConfigurator({ v: 2, step: 'type', draft }, model)).toBeNull();
    expect(readStoredConfigurator('draft', model)).toBeNull();
    data.set(CONFIGURATOR_STORAGE_KEY, '{not json');
    expect(loadConfigurator(model)).toBeNull();
  });

  it('drops stale ids and moves the step back to the last enterable one', () => {
    const loaded = readStoredConfigurator(
      {
        v: 1,
        step: 'summary',
        draft: { ...draft, features: ['web/removed'], budget: 'gone' },
      },
      model,
    );
    expect(loaded?.draft.features).toEqual([]);
    expect(loaded?.draft.budget).toBeNull();
    expect(loaded?.step).toBe('features');
  });

  it('falls back to the first step for an unknown step id', () => {
    expect(readStoredConfigurator({ v: 1, step: 'nope', draft }, model)?.step).toBe('type');
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
    expect(saveConfigurator(draft, 'type')).toBe(false);
    expect(loadConfigurator(model)).toBeNull();
    expect(() => clearConfigurator()).not.toThrow();
  });
});
