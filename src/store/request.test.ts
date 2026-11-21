import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_STORAGE_KEY } from '@/lib/request-draft';
import { hasRef, useRequestStore } from './request';

const valid = new Set(['web/landing-pages', 'crm/custom-crm', 'ai/ai-assistants']);
let data: Map<string, string>;

function stubStorage(overrides: Partial<Storage> = {}) {
  data = new Map();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    ...overrides,
  };
  vi.stubGlobal('window', { localStorage: storage });
}

const stored = () => JSON.parse(data.get(REQUEST_STORAGE_KEY) ?? 'null') as unknown;

beforeEach(() => {
  useRequestStore.setState(useRequestStore.getInitialState(), true);
  stubStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useRequestStore', () => {
  it('starts empty and not hydrated (server and first client render agree)', () => {
    const state = useRequestStore.getState();
    expect(state.items).toEqual([]);
    expect(state.hydrated).toBe(false);
  });

  it('hydrates from storage, dropping unknown refs, and rewrites the cleaned draft', () => {
    data.set(
      REQUEST_STORAGE_KEY,
      JSON.stringify({ v: 1, items: ['crm/custom-crm', 'web/gone', 'web/landing-pages'] }),
    );
    useRequestStore.getState().hydrate(valid);
    expect(useRequestStore.getState().items).toEqual(['crm/custom-crm', 'web/landing-pages']);
    expect(useRequestStore.getState().hydrated).toBe(true);
    expect(stored()).toEqual({ v: 1, items: ['crm/custom-crm', 'web/landing-pages'] });
  });

  it('keeps items added before hydration and merges them after the stored ones', () => {
    data.set(REQUEST_STORAGE_KEY, JSON.stringify({ v: 1, items: ['crm/custom-crm'] }));
    useRequestStore.getState().add('web/landing-pages');
    expect(data.get(REQUEST_STORAGE_KEY)).toBe(JSON.stringify({ v: 1, items: ['crm/custom-crm'] }));
    useRequestStore.getState().hydrate(valid);
    expect(useRequestStore.getState().items).toEqual(['crm/custom-crm', 'web/landing-pages']);
    expect(stored()).toEqual({ v: 1, items: ['crm/custom-crm', 'web/landing-pages'] });
  });

  it('adds, toggles and removes, persisting every change', () => {
    const store = useRequestStore.getState();
    store.hydrate(valid);
    store.add('web/landing-pages');
    store.toggle('crm/custom-crm');
    expect(stored()).toEqual({ v: 1, items: ['web/landing-pages', 'crm/custom-crm'] });
    expect(hasRef(useRequestStore.getState(), 'crm/custom-crm')).toBe(true);
    store.toggle('crm/custom-crm');
    store.remove('web/landing-pages');
    expect(useRequestStore.getState().items).toEqual([]);
    expect(data.has(REQUEST_STORAGE_KEY)).toBe(false);
  });

  it('ignores unknown refs once the known services are set', () => {
    const store = useRequestStore.getState();
    store.hydrate(valid);
    store.add('web/not-a-service');
    store.toggle('web/not-a-service');
    expect(useRequestStore.getState().items).toEqual([]);
  });

  it('clear() empties the draft and the storage', () => {
    const store = useRequestStore.getState();
    store.hydrate(valid);
    store.add('ai/ai-assistants');
    store.clear();
    expect(useRequestStore.getState().items).toEqual([]);
    expect(data.has(REQUEST_STORAGE_KEY)).toBe(false);
  });

  it('a later hydrate (storage event from another tab) replaces the draft', () => {
    const store = useRequestStore.getState();
    store.hydrate(valid);
    store.add('web/landing-pages');
    data.set(REQUEST_STORAGE_KEY, JSON.stringify({ v: 1, items: ['ai/ai-assistants'] }));
    store.hydrate(valid);
    expect(useRequestStore.getState().items).toEqual(['ai/ai-assistants']);
  });

  it('keeps working in memory when storage throws', () => {
    stubStorage({
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    });
    const store = useRequestStore.getState();
    expect(() => store.hydrate(valid)).not.toThrow();
    store.add('web/landing-pages');
    expect(useRequestStore.getState().items).toEqual(['web/landing-pages']);
  });
});
