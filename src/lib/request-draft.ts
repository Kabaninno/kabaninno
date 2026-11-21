/**
 * Pure helpers for the request draft (the services a visitor added with
 * «Add to request»). State and persistence live in `src/store/request.ts`.
 *
 * A service ref is `"<category>/<slug>"`, the same string the configurator's
 * `?add=` query carries (e.g. `"web/landing-pages"`).
 */

/** localStorage key; bump the version when the stored shape changes. */
export const REQUEST_STORAGE_KEY = 'kabaninno.request.v1';

export interface StoredRequest {
  v: 1;
  items: string[];
}

export function serviceRef(categoryId: string, serviceSlug: string): string {
  return `${categoryId}/${serviceSlug}`;
}

/** Keeps the first occurrence of each ref, in order. */
function unique(refs: readonly string[]): string[] {
  return [...new Set(refs)];
}

/**
 * Reads a stored draft defensively: anything that is not a v1 draft yields
 * an empty list, non-string items are skipped, and refs that no longer match
 * a service (renamed or removed content) are dropped.
 */
export function parseStoredRequest(value: unknown, validRefs: ReadonlySet<string>): string[] {
  if (value === null || typeof value !== 'object') return [];
  const draft = value as Partial<StoredRequest>;
  if (draft.v !== 1 || !Array.isArray(draft.items)) return [];
  return unique(
    draft.items.filter((item): item is string => typeof item === 'string' && validRefs.has(item)),
  );
}

export function serializeRequest(items: readonly string[]): StoredRequest {
  return { v: 1, items: [...items] };
}

export function addRef(items: readonly string[], ref: string): string[] {
  return items.includes(ref) ? [...items] : [...items, ref];
}

export function removeRef(items: readonly string[], ref: string): string[] {
  return items.filter((item) => item !== ref);
}

export function toggleRef(items: readonly string[], ref: string): string[] {
  return items.includes(ref) ? removeRef(items, ref) : addRef(items, ref);
}

/**
 * Merges what was stored with what was added before the store hydrated
 * (stored order first), keeping only valid refs.
 */
export function mergeRequest(
  stored: readonly string[],
  current: readonly string[],
  validRefs: ReadonlySet<string>,
): string[] {
  return unique([...stored, ...current]).filter((ref) => validRefs.has(ref));
}
