import { describe, expect, it } from 'vitest';
import { emptyDraft, toggleFeature, toggleType } from './draft';
import { getConfiguratorModel } from './model';
import {
  MESSAGE_EDIT_MAX,
  editMessage,
  emphasisForDraft,
  isEditStale,
  keepEdit,
  messageText,
  parseMessageEdit,
  requestSync,
  serviceRefsOf,
  startingDraft,
  urlWithoutPrefill,
} from './session';

const model = getConfiguratorModel();

describe('emphasisForDraft (D81)', () => {
  it('maps the selected solution types to category node ids', () => {
    expect(emphasisForDraft({ types: ['web', 'ai'] })).toEqual(['category:web', 'category:ai']);
    expect(emphasisForDraft(emptyDraft())).toEqual([]);
  });
});

describe('startingDraft (prefill)', () => {
  it('adds request services and ?add= refs and reports what was new', () => {
    const { draft, added } = startingDraft(
      emptyDraft(),
      ['crm/custom-crm', 'web/landing-pages', 'web/landing-pages', 'nope/x'],
      model,
    );
    expect(draft.types).toEqual(['web', 'crm']);
    expect(draft.features).toEqual(['crm/custom-crm', 'web/landing-pages']);
    expect(added).toEqual(['crm/custom-crm', 'web/landing-pages']);
  });

  it('is idempotent: nothing new on a stored draft that already has them', () => {
    const base = startingDraft(emptyDraft(), ['crm/custom-crm'], model).draft;
    const again = startingDraft(base, ['crm/custom-crm'], model);
    expect(again.draft).toEqual(base);
    expect(again.added).toEqual([]);
  });

  it('keeps the visitor’s other answers', () => {
    const base = { ...emptyDraft(), budget: 'not-sure', timeline: 'asap' };
    const { draft } = startingDraft(base, ['ai/ai-assistants'], model);
    expect(draft.budget).toBe('not-sure');
    expect(draft.timeline).toBe('asap');
  });
});

describe('requestSync (D66 mirrors the wizard’s services)', () => {
  it('adds selected services and removes deselected ones; extras are not services', () => {
    let draft = toggleType(emptyDraft(), 'web', model);
    const before = draft;
    draft = toggleFeature(draft, 'web/landing-pages', model);
    draft = toggleFeature(draft, 'web/seo', model);
    expect(serviceRefsOf(draft, model)).toEqual(['web/landing-pages']);
    expect(requestSync(before, draft, model)).toEqual({ add: ['web/landing-pages'], remove: [] });
    const deselected = toggleType(draft, 'web', model);
    expect(requestSync(draft, deselected, model)).toEqual({
      add: [],
      remove: ['web/landing-pages'],
    });
  });
});

describe('message edits (Q-F3-01)', () => {
  const OLD = 'Budżet: Jeszcze nie wiem';
  const NEW = 'Budżet: 15 000–40 000 PLN';

  it('uses the default until the visitor edits, then the edit', () => {
    expect(messageText(null, OLD)).toBe(OLD);
    const edit = editMessage(null, `${OLD}\nPS`, OLD);
    expect(edit).toEqual({
      text: `${OLD}\nPS`,
      base: OLD,
    });
    expect(messageText(edit, OLD)).toBe(`${OLD}\nPS`);
  });

  it('keeps the base across keystrokes', () => {
    const first = editMessage(null, 'a', OLD);
    expect(editMessage(first, 'ab', NEW).base).toBe(OLD);
  });

  it('is stale once the answers change the default', () => {
    const edit = editMessage(null, `${OLD}\nPS`, OLD);
    expect(isEditStale(edit, OLD)).toBe(false);
    expect(isEditStale(edit, NEW)).toBe(true);
    expect(isEditStale(null, NEW)).toBe(false);
  });

  it('is not stale when the edit equals the new default', () => {
    expect(isEditStale({ text: NEW, base: OLD }, NEW)).toBe(false);
  });

  it('"Keep my text" rebases the edit, so the notice goes', () => {
    const edit = editMessage(null, `${OLD}\nPS`, OLD);
    const kept = keepEdit(edit, NEW);
    expect(kept.text).toBe(edit.text);
    expect(isEditStale(kept, NEW)).toBe(false);
  });

  it('parses stored edits defensively', () => {
    expect(parseMessageEdit({ text: 'a', base: 'b' })).toEqual({ text: 'a', base: 'b' });
    expect(parseMessageEdit({ text: 'a' })).toBeNull();
    expect(parseMessageEdit('a')).toBeNull();
    expect(parseMessageEdit(null)).toBeNull();
    expect(parseMessageEdit({ text: 'x'.repeat(MESSAGE_EDIT_MAX + 1), base: 'b' })).toBeNull();
  });
});

describe('urlWithoutPrefill (Q-F3-02)', () => {
  const base = 'https://user.github.io/kabaninno/pl/configurator/';

  it('drops add= and keeps other parameters and the hash', () => {
    expect(urlWithoutPrefill(`${base}?add=web/seo&utm_source=x#top`)).toBe(
      '/kabaninno/pl/configurator/?utm_source=x#top',
    );
    expect(urlWithoutPrefill(`${base}?add=a&add=b`)).toBe('/kabaninno/pl/configurator/');
  });

  it('returns null when there is nothing to remove', () => {
    expect(urlWithoutPrefill(`${base}?utm_source=x`)).toBeNull();
    expect(urlWithoutPrefill(base)).toBeNull();
  });
});
