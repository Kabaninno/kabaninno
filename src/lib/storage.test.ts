import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from './storage';

/** In-memory Storage double; individual methods can be replaced per test. */
function memoryStorage(overrides: Partial<Storage> = {}): Storage {
  const data = new Map<string, string>();
  return {
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
}

function stubWindowWith(storage: Storage) {
  vi.stubGlobal('window', { localStorage: storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeStorage', () => {
  it('round-trips JSON values', () => {
    stubWindowWith(memoryStorage());
    expect(safeStorage.setJSON('draft', { step: 2, items: ['web/landing-pages'] })).toBe(true);
    expect(safeStorage.getJSON('draft')).toEqual({ step: 2, items: ['web/landing-pages'] });
    safeStorage.remove('draft');
    expect(safeStorage.getJSON('draft')).toBeNull();
  });

  it('works without a window (SSR / build time)', () => {
    expect(typeof window).toBe('undefined');
    expect(safeStorage.getJSON('draft')).toBeNull();
    expect(safeStorage.setJSON('draft', 1)).toBe(false);
    expect(() => safeStorage.remove('draft')).not.toThrow();
  });

  it('survives storage that throws on access (blocked cookies / sandboxed iframes)', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('Access denied', 'SecurityError');
      },
    });
    expect(safeStorage.getJSON('draft')).toBeNull();
    expect(safeStorage.setJSON('draft', 1)).toBe(false);
    expect(() => safeStorage.remove('draft')).not.toThrow();
  });

  it('reports quota errors on write instead of throwing', () => {
    stubWindowWith(
      memoryStorage({
        setItem: () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        },
      }),
    );
    expect(safeStorage.setJSON('draft', 'x'.repeat(10))).toBe(false);
  });

  it('returns null for invalid JSON and for values rejected by the parser', () => {
    const storage = memoryStorage();
    stubWindowWith(storage);
    storage.setItem('broken', '{not json');
    expect(safeStorage.getJSON('broken')).toBeNull();

    storage.setItem('draft', JSON.stringify({ step: 'two' }));
    const parse = (value: unknown) => {
      const step = (value as { step?: unknown }).step;
      if (typeof step !== 'number') throw new Error('invalid draft');
      return { step };
    };
    expect(safeStorage.getJSON('draft', parse)).toBeNull();
    storage.setItem('draft', JSON.stringify({ step: 3 }));
    expect(safeStorage.getJSON('draft', parse)).toEqual({ step: 3 });
  });

  it('ignores errors from getItem and removeItem', () => {
    stubWindowWith(
      memoryStorage({
        getItem: () => {
          throw new Error('boom');
        },
        removeItem: () => {
          throw new Error('boom');
        },
      }),
    );
    expect(safeStorage.getJSON('draft')).toBeNull();
    expect(() => safeStorage.remove('draft')).not.toThrow();
  });

  it('does not write values JSON cannot encode', () => {
    stubWindowWith(memoryStorage());
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(safeStorage.setJSON('draft', circular)).toBe(false);
  });
});
