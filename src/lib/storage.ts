/**
 * localStorage wrapper that never throws (private mode, blocked storage,
 * quota errors, SSR). Values are JSON-encoded.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  getJSON<T>(key: string, parse?: (value: unknown) => T): T | null {
    try {
      const raw = getStorage()?.getItem(key);
      if (raw == null) return null;
      const value: unknown = JSON.parse(raw);
      return parse ? parse(value) : (value as T);
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown): boolean {
    try {
      const storage = getStorage();
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      getStorage()?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
