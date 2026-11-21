import { create } from 'zustand';
import {
  REQUEST_STORAGE_KEY,
  addRef,
  mergeRequest,
  parseStoredRequest,
  removeRef,
  serializeRequest,
  toggleRef,
} from '@/lib/request-draft';
import { safeStorage } from '@/lib/storage';

/**
 * Request draft: the services the visitor added with «Add to request» on the
 * planet panels. The configurator (M4) reads and edits the same store.
 *
 * API
 * - `items`: service refs `"<category>/<slug>"` in the order they were added
 *   (the same strings as the configurator's `?add=` query).
 * - `add(ref)`, `remove(ref)`, `toggle(ref)`, `clear()`: change the draft and
 *   persist it (localStorage, `REQUEST_STORAGE_KEY`, through `safeStorage`:
 *   never throws; private mode just keeps the draft in memory).
 * - `hasRef(state, ref)` / `useHasRef(ref)`: membership, for selectors.
 * - `hydrated`: false until the stored draft has been read on the client.
 *
 * Hydration safety: the store starts empty on the server AND on the first
 * client render, so server HTML and hydration agree. `RequestSync` (mounted
 * once in the locale layout) then calls `hydrate(validRefs)` in an effect: it
 * reads the stored draft, drops refs that no longer match a service, merges
 * anything added in the meantime, and keeps tabs in sync through `storage`
 * events. Writes before hydration are kept and merged.
 */
interface RequestState {
  items: string[];
  hydrated: boolean;
  /** Services known to this build; set by `hydrate`. */
  validRefs: ReadonlySet<string> | null;
  add: (ref: string) => void;
  remove: (ref: string) => void;
  toggle: (ref: string) => void;
  clear: () => void;
  /** Reads (or re-reads, on a `storage` event) the persisted draft. */
  hydrate: (validRefs: ReadonlySet<string>) => void;
}

function accepts(state: RequestState, ref: string): boolean {
  return state.validRefs === null || state.validRefs.has(ref);
}

function persist(items: readonly string[]): void {
  if (items.length === 0) safeStorage.remove(REQUEST_STORAGE_KEY);
  else safeStorage.setJSON(REQUEST_STORAGE_KEY, serializeRequest(items));
}

export const useRequestStore = create<RequestState>()((set, get) => {
  const update = (next: string[]) => {
    set({ items: next });
    if (get().hydrated) persist(next);
  };
  return {
    items: [],
    hydrated: false,
    validRefs: null,
    add: (ref) => {
      if (accepts(get(), ref)) update(addRef(get().items, ref));
    },
    remove: (ref) => update(removeRef(get().items, ref)),
    toggle: (ref) => {
      const state = get();
      if (state.items.includes(ref) || accepts(state, ref)) update(toggleRef(state.items, ref));
    },
    clear: () => update([]),
    hydrate: (validRefs) => {
      const stored = parseStoredRequest(safeStorage.getJSON(REQUEST_STORAGE_KEY), validRefs);
      const state = get();
      // A re-read (another tab changed the draft) replaces; the first read merges.
      const items = state.hydrated ? stored : mergeRequest(stored, state.items, validRefs);
      set({ items, hydrated: true, validRefs });
      if (!state.hydrated) persist(items);
    },
  };
});

export function hasRef(state: Pick<RequestState, 'items'>, ref: string): boolean {
  return state.items.includes(ref);
}

/** True when `ref` is in the draft (re-renders only when that changes). */
export function useHasRef(ref: string): boolean {
  return useRequestStore((state) => hasRef(state, ref));
}

/** Number of services in the draft. */
export function useRequestCount(): number {
  return useRequestStore((state) => state.items.length);
}
