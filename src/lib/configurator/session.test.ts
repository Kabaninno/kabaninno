import { describe, expect, it } from 'vitest';
import { emptyDraft, toggleFeature, toggleType } from './draft';
import { getConfiguratorModel } from './model';
import { emphasisForDraft, requestSync, serviceRefsOf, startingDraft } from './session';

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
