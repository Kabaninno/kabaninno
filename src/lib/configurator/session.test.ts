import { describe, expect, it } from 'vitest';
import { addService, emptyDraft, removeService, setAnswer, toggleGoal } from './draft';
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
  startingState,
  urlWithoutPrefill,
} from './session';

const model = getConfiguratorModel();

describe('emphasisForDraft (D81)', () => {
  it('maps the categories of the services so far to category node ids', () => {
    expect(emphasisForDraft(emptyDraft(), model)).toEqual([]);
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    expect(emphasisForDraft(draft, model)).toEqual(['category:automation', 'category:telegram']);
    draft = addService(draft, 'web/landing-pages', model);
    expect(emphasisForDraft(draft, model)).toEqual([
      'category:web',
      'category:automation',
      'category:telegram',
    ]);
  });
});

describe('startingState (prefill)', () => {
  it('picks request services and ?add= refs, reports what was new and continues manually', () => {
    const start = startingState(
      null,
      ['crm/custom-crm', 'web/landing-pages', 'web/landing-pages', 'nope/x'],
      model,
    );
    expect(start.draft.added).toEqual(['crm/custom-crm', 'web/landing-pages']);
    expect(start.added).toEqual(['crm/custom-crm', 'web/landing-pages']);
    // The visitor answered no goal: they know what they want (D150).
    expect(start.draft.mode).toBe('manual');
    expect(start.step).toBe('solution');
    expect(start.message).toBeNull();
  });

  it('starts on the goals step with an empty draft when there is nothing to add', () => {
    const start = startingState(null, [], model);
    expect(start).toEqual({ draft: emptyDraft(), step: 'goals', message: null, added: [] });
  });

  it('is idempotent: nothing new on a stored draft that already has them', () => {
    const first = startingState(null, ['crm/custom-crm'], model);
    const stored = { draft: first.draft, step: first.step, message: null };
    const again = startingState(stored, ['crm/custom-crm'], model);
    expect(again.draft).toEqual(first.draft);
    expect(again.added).toEqual([]);
    expect(again.step).toBe('solution');
  });

  it('does not take over a guided draft: the visitor keeps their goals and step', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    const start = startingState(
      { draft, step: 'details', message: null },
      ['web/landing-pages'],
      model,
    );
    expect(start.draft.mode).toBe('guided');
    expect(start.draft.goals).toEqual(['booking']);
    expect(start.draft.added).toEqual(['web/landing-pages']);
    expect(start.step).toBe('details');
  });

  it('keeps the visitor’s other answers', () => {
    const base = { ...emptyDraft(), budget: 'not-sure', timeline: 'asap' };
    const { draft } = startingState(
      { draft: base, step: 'plan', message: null },
      ['ai/ai-assistants'],
      model,
    );
    expect(draft.budget).toBe('not-sure');
    expect(draft.timeline).toBe('asap');
  });
});

describe('requestSync (D66 mirrors the services the visitor picked)', () => {
  it('adds picked services and removes dropped ones; recommended ones are not mirrored', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    expect(serviceRefsOf(draft)).toEqual([]);
    const before = draft;
    draft = addService(draft, 'web/landing-pages', model);
    expect(serviceRefsOf(draft)).toEqual(['web/landing-pages']);
    expect(requestSync(before, draft)).toEqual({ add: ['web/landing-pages'], remove: [] });
    // Dropping a recommended service does not touch the request draft.
    const droppedRecommended = removeService(draft, 'telegram/booking', model);
    expect(requestSync(draft, droppedRecommended)).toEqual({ add: [], remove: [] });
    const dropped = removeService(draft, 'web/landing-pages', model);
    expect(requestSync(draft, dropped)).toEqual({ add: [], remove: ['web/landing-pages'] });
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
