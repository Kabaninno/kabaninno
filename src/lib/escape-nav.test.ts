import { describe, expect, it } from 'vitest';
import {
  escapeAction,
  isEditableElement,
  shouldHandleEscape,
  type EscapeKeyLike,
} from './escape-nav';

describe('escapeAction', () => {
  it('does nothing in the universe', () => {
    expect(escapeAction('/', 'pl', null)).toEqual({ type: 'none' });
    expect(escapeAction('/', 'pl', '/pl/services/web/')).toEqual({ type: 'none' });
  });

  it('does nothing for unknown paths', () => {
    expect(escapeAction('/nope/at/all/', 'pl', '/pl/')).toEqual({ type: 'none' });
  });

  it('pushes the parent when the history does not know it (deep link)', () => {
    expect(escapeAction('/services/web/landing-pages/', 'pl', null)).toEqual({
      type: 'push',
      path: '/services/web/',
    });
    expect(escapeAction('/services/web/', 'en', null)).toEqual({ type: 'push', path: '/' });
    expect(escapeAction('/portfolio/some-case/', 'uk', null)).toEqual({
      type: 'push',
      path: '/portfolio/',
    });
    expect(escapeAction('/portfolio/', 'pl', null)).toEqual({ type: 'push', path: '/' });
    expect(escapeAction('/configurator/', 'pl', null)).toEqual({ type: 'push', path: '/' });
  });

  it('goes back when the previous entry is the parent (same locale)', () => {
    expect(escapeAction('/services/web/landing-pages/', 'pl', '/pl/services/web/')).toEqual({
      type: 'back',
    });
    expect(escapeAction('/services/crm/', 'uk', '/uk/')).toEqual({ type: 'back' });
    expect(escapeAction('/portfolio/some-case/', 'en', '/en/portfolio/')).toEqual({ type: 'back' });
    expect(escapeAction('/configurator/', 'pl', '/pl/')).toEqual({ type: 'back' });
  });

  it('tolerates a missing trailing slash on the previous entry', () => {
    expect(escapeAction('/services/web/', 'pl', '/pl')).toEqual({ type: 'back' });
    expect(escapeAction('/services/web/x/', 'pl', '/pl/services/web')).toEqual({ type: 'back' });
  });

  it('pushes when the previous entry is not the parent', () => {
    // Came from a sibling planet (e.g. after an arrow-key replace) or another system.
    expect(escapeAction('/services/web/a/', 'pl', '/pl/services/web/b/')).toEqual({
      type: 'push',
      path: '/services/web/',
    });
    expect(escapeAction('/services/web/', 'pl', '/pl/services/crm/')).toEqual({
      type: 'push',
      path: '/',
    });
    // Same page in another locale (locale switch) is not the parent.
    expect(escapeAction('/services/web/', 'pl', '/en/')).toEqual({ type: 'push', path: '/' });
  });
});

const esc = (overrides: Partial<EscapeKeyLike> = {}): EscapeKeyLike => ({
  key: 'Escape',
  defaultPrevented: false,
  ...overrides,
});
const free = { editableTarget: false, dialogOpen: false };

describe('shouldHandleEscape', () => {
  it('handles a plain Escape', () => {
    expect(shouldHandleEscape(esc(), free)).toBe(true);
    expect(shouldHandleEscape(esc({ key: 'Esc' }), free)).toBe(true);
  });

  it('ignores other keys', () => {
    expect(shouldHandleEscape(esc({ key: 'Enter' }), free)).toBe(false);
    expect(shouldHandleEscape(esc({ key: 'Backspace' }), free)).toBe(false);
  });

  it('ignores events another layer consumed (D27)', () => {
    expect(shouldHandleEscape(esc({ defaultPrevented: true }), free)).toBe(false);
  });

  it('ignores auto-repeat, IME composition and modifiers', () => {
    expect(shouldHandleEscape(esc({ repeat: true }), free)).toBe(false);
    expect(shouldHandleEscape(esc({ isComposing: true }), free)).toBe(false);
    expect(shouldHandleEscape(esc({ shiftKey: true }), free)).toBe(false);
    expect(shouldHandleEscape(esc({ ctrlKey: true }), free)).toBe(false);
    expect(shouldHandleEscape(esc({ altKey: true }), free)).toBe(false);
    expect(shouldHandleEscape(esc({ metaKey: true }), free)).toBe(false);
  });

  it('ignores text fields and open dialogs', () => {
    expect(shouldHandleEscape(esc(), { editableTarget: true, dialogOpen: false })).toBe(false);
    expect(shouldHandleEscape(esc(), { editableTarget: false, dialogOpen: true })).toBe(false);
  });
});

describe('isEditableElement', () => {
  const el = (tagName: string, extra: { contentEditable?: boolean; role?: string } = {}) => ({
    tagName,
    isContentEditable: extra.contentEditable ?? false,
    getAttribute: (name: string) => (name === 'role' ? (extra.role ?? null) : null),
  });

  it('detects form fields', () => {
    expect(isEditableElement(el('INPUT'))).toBe(true);
    expect(isEditableElement(el('textarea'))).toBe(true);
    expect(isEditableElement(el('SELECT'))).toBe(true);
  });

  it('detects contenteditable hosts and ARIA text widgets', () => {
    expect(isEditableElement(el('DIV', { contentEditable: true }))).toBe(true);
    expect(isEditableElement(el('DIV', { role: 'textbox' }))).toBe(true);
    expect(isEditableElement(el('DIV', { role: 'combobox' }))).toBe(true);
  });

  it('treats links, buttons, regions and nothing as non-editable', () => {
    expect(isEditableElement(el('A'))).toBe(false);
    expect(isEditableElement(el('BUTTON'))).toBe(false);
    expect(isEditableElement(el('SECTION', { role: 'region' }))).toBe(false);
    expect(isEditableElement(null)).toBe(false);
    expect(isEditableElement(undefined)).toBe(false);
  });
});
