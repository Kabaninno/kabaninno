import { describe, expect, it } from 'vitest';
import {
  addRef,
  mergeRequest,
  parseStoredRequest,
  removeRef,
  serializeRequest,
  serviceRef,
  toggleRef,
} from './request-draft';

const valid = new Set(['web/landing-pages', 'crm/custom-crm', 'ai/ai-assistants']);

describe('serviceRef', () => {
  it('joins category and slug like the ?add= query', () => {
    expect(serviceRef('web', 'landing-pages')).toBe('web/landing-pages');
  });
});

describe('parseStoredRequest', () => {
  it('reads a v1 draft and keeps the order', () => {
    expect(
      parseStoredRequest({ v: 1, items: ['crm/custom-crm', 'web/landing-pages'] }, valid),
    ).toEqual(['crm/custom-crm', 'web/landing-pages']);
  });

  it('drops refs that no longer match a service, duplicates and non-strings', () => {
    expect(
      parseStoredRequest(
        { v: 1, items: ['web/landing-pages', 'web/removed', 42, null, 'web/landing-pages'] },
        valid,
      ),
    ).toEqual(['web/landing-pages']);
  });

  it('ignores anything that is not a v1 draft', () => {
    expect(parseStoredRequest(null, valid)).toEqual([]);
    expect(parseStoredRequest('web/landing-pages', valid)).toEqual([]);
    expect(parseStoredRequest(['web/landing-pages'], valid)).toEqual([]);
    expect(parseStoredRequest({ v: 2, items: ['web/landing-pages'] }, valid)).toEqual([]);
    expect(parseStoredRequest({ v: 1, items: 'web/landing-pages' }, valid)).toEqual([]);
  });
});

describe('add / remove / toggle', () => {
  it('adds once, at the end', () => {
    expect(addRef([], 'web/landing-pages')).toEqual(['web/landing-pages']);
    expect(addRef(['a/b'], 'a/b')).toEqual(['a/b']);
    expect(addRef(['a/b'], 'c/d')).toEqual(['a/b', 'c/d']);
  });

  it('removes and toggles without mutating the input', () => {
    const items = ['a/b', 'c/d'];
    expect(removeRef(items, 'a/b')).toEqual(['c/d']);
    expect(toggleRef(items, 'c/d')).toEqual(['a/b']);
    expect(toggleRef(items, 'e/f')).toEqual(['a/b', 'c/d', 'e/f']);
    expect(items).toEqual(['a/b', 'c/d']);
  });
});

describe('mergeRequest', () => {
  it('puts stored items first, then items added before hydration, deduplicated and valid', () => {
    expect(
      mergeRequest(['crm/custom-crm'], ['web/landing-pages', 'crm/custom-crm', 'x/y'], valid),
    ).toEqual(['crm/custom-crm', 'web/landing-pages']);
  });
});

describe('serializeRequest', () => {
  it('writes a versioned copy', () => {
    const items = ['a/b'];
    const stored = serializeRequest(items);
    expect(stored).toEqual({ v: 1, items: ['a/b'] });
    expect(stored.items).not.toBe(items);
  });
});
