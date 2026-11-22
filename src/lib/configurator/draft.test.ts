import { describe, expect, it } from 'vitest';
import { CONFIGURATOR_STEPS, stepsFor } from '../configurator-steps';
import {
  addService,
  canEnterStep,
  chooseGuided,
  chooseManual,
  configuratorDraftSchema,
  emptyDraft,
  firstInvalidStep,
  furthestEnterableStep,
  neighbourStep,
  prefillDraft,
  refsFromSearch,
  removeService,
  sanitizeDraft,
  servicesOf,
  setAnswer,
  stepInMode,
  toggleGoal,
  toggleHave,
  toggleService,
  validateStep,
  type ConfiguratorDraft,
} from './draft';
import { GOAL_UNSURE, HAVE_NONE, getConfiguratorModel } from './model';

const model = getConfiguratorModel();

/** A complete guided draft: two goals answered, one service added on top. */
function completeDraft(): ConfiguratorDraft {
  return {
    mode: 'guided',
    goals: ['online-orders', 'client-order'],
    answers: { 'online-orders': '20-200', 'client-order': 'program-inconvenient' },
    have: ['website'],
    removed: [],
    added: ['automation/notifications-reminders'],
    industry: 'retail',
    industryOther: '',
    contact: { name: '  Ola  ', comment: 'Potrzebujemy sklepu z integracją CRM.' },
  };
}

describe('validateStep', () => {
  it('accepts a complete draft on every step', () => {
    for (const step of CONFIGURATOR_STEPS) {
      expect(validateStep(step, completeDraft(), model), step).toEqual({});
    }
  });

  it('goals: at least one known goal, at most the limit, "not sure" alone', () => {
    expect(validateStep('goals', emptyDraft(), model)).toEqual({ goals: 'required' });
    expect(validateStep('goals', { ...emptyDraft(), goals: ['nope'] }, model)).toEqual({
      goals: 'unknown',
    });
    const tooMany = { ...emptyDraft(), goals: model.goals.slice(0, 4).map((goal) => goal.id) };
    expect(validateStep('goals', tooMany, model)).toEqual({ goals: 'unknown' });
    expect(validateStep('goals', { ...emptyDraft(), goals: [GOAL_UNSURE] }, model)).toEqual({});
    expect(
      validateStep('goals', { ...emptyDraft(), goals: [GOAL_UNSURE, 'booking'] }, model),
    ).toEqual({ goals: 'unknown' });
  });

  it('goals: not needed in the manual mode', () => {
    expect(validateStep('goals', { ...emptyDraft(), mode: 'manual' }, model)).toEqual({});
  });

  it('details: every picked goal needs a known answer', () => {
    const draft = { ...emptyDraft(), goals: ['booking', 'less-routine'] };
    expect(validateStep('details', draft, model)).toEqual({
      'answers.booking': 'required',
      'answers.less-routine': 'required',
    });
    expect(
      validateStep(
        'details',
        { ...draft, answers: { booking: 'nope', 'less-routine': 'documents' } },
        model,
      ),
    ).toEqual({ 'answers.booking': 'unknown' });
    expect(validateStep('details', { ...emptyDraft(), goals: [GOAL_UNSURE] }, model)).toEqual({});
    expect(validateStep('details', { ...emptyDraft(), have: ['nope'] }, model)).toEqual({
      have: 'unknown',
    });
  });

  it('solution: never blocks, even without services', () => {
    expect(validateStep('solution', emptyDraft(), model)).toEqual({});
    expect(validateStep('solution', { ...emptyDraft(), added: ['web/ghost'] }, model)).toEqual({
      services: 'unknown',
    });
  });

  it('industry: optional, but a known id; "other" text up to the limit (D155)', () => {
    expect(validateStep('industry', emptyDraft(), model)).toEqual({});
    expect(validateStep('industry', { ...emptyDraft(), industry: 'food' }, model)).toEqual({});
    expect(validateStep('industry', { ...emptyDraft(), industry: 'nope' }, model)).toEqual({
      industry: 'unknown',
    });
    expect(
      validateStep(
        'industry',
        { ...emptyDraft(), industry: 'other', industryOther: 'x'.repeat(61) },
        model,
      ),
    ).toEqual({ industry: 'tooLong' });
  });

  it('contact: name required, 2–80 characters after trimming; comment up to the limit', () => {
    const draft = completeDraft();
    expect(
      validateStep('contact', { ...draft, contact: { name: '  ', comment: '' } }, model),
    ).toEqual({
      'contact.name': 'required',
    });
    expect(
      validateStep('contact', { ...draft, contact: { name: 'O', comment: '' } }, model),
    ).toEqual({
      'contact.name': 'tooShort',
    });
    expect(
      validateStep('contact', { ...draft, contact: { name: 'x'.repeat(81), comment: '' } }, model),
    ).toEqual({ 'contact.name': 'tooLong' });
    expect(
      validateStep(
        'contact',
        { ...draft, contact: { name: 'Ola', comment: 'x'.repeat(1001) } },
        model,
      ),
    ).toEqual({ 'contact.comment': 'tooLong' });
    expect(
      validateStep(
        'contact',
        { ...draft, contact: { name: 'Ola', comment: 'x'.repeat(1000) } },
        model,
      ),
    ).toEqual({});
  });
});

describe('step navigation', () => {
  it('canEnterStep needs every earlier step of the mode to be valid', () => {
    const draft = completeDraft();
    expect(canEnterStep('goals', emptyDraft(), model)).toBe(true);
    expect(canEnterStep('details', emptyDraft(), model)).toBe(false);
    expect(canEnterStep('contact', draft, model)).toBe(true);
    expect(canEnterStep('contact', { ...draft, industry: 'nope' }, model)).toBe(false);
    // The industry is optional: an empty draft may start with the goals.
    expect(canEnterStep('industry', emptyDraft(), model)).toBe(true);
    expect(canEnterStep('solution', { ...draft, answers: {} }, model)).toBe(false);
  });

  it('the manual mode skips the details step', () => {
    const manual = { ...emptyDraft(), mode: 'manual' as const };
    expect(stepsFor('manual')).not.toContain('details');
    expect(canEnterStep('details', manual, model)).toBe(false);
    expect(canEnterStep('solution', manual, model)).toBe(true);
    expect(neighbourStep(manual, 'goals', 1)).toBe('solution');
    expect(neighbourStep(manual, 'solution', -1)).toBe('goals');
    expect(neighbourStep(emptyDraft(), 'goals', 1)).toBe('details');
    expect(neighbourStep(emptyDraft(), 'goals', -1)).toBe('industry');
    expect(neighbourStep(emptyDraft(), 'industry', -1)).toBeUndefined();
    expect(neighbourStep(manual, 'industry', 1)).toBe('goals');
    expect(neighbourStep(emptyDraft(), 'contact', 1)).toBeUndefined();
  });

  it('finds the first invalid step and the furthest enterable one', () => {
    expect(firstInvalidStep(completeDraft(), model)).toBeNull();
    expect(furthestEnterableStep(completeDraft(), model)).toBe('contact');
    const noName = { ...completeDraft(), contact: { name: '', comment: '' } };
    expect(firstInvalidStep(noName, model)).toBe('contact');
    expect(furthestEnterableStep(noName, model)).toBe('contact');
    expect(furthestEnterableStep(emptyDraft(), model)).toBe('goals');
    const manual = { ...emptyDraft(), mode: 'manual' as const };
    expect(firstInvalidStep(manual, model)).toBe('contact');
    expect(firstInvalidStep({ ...manual, industry: 'nope' }, model)).toBe('industry');
  });

  it('stepInMode maps a step the mode does not have to the first one', () => {
    expect(stepInMode(emptyDraft(), 'details')).toBe('details');
    expect(stepInMode({ mode: 'manual' }, 'details')).toBe('industry');
    expect(stepInMode({ mode: 'manual' }, 'solution')).toBe('solution');
  });
});

describe('toggleGoal', () => {
  it('selects and deselects, switching to the guided mode', () => {
    let draft = chooseManual(emptyDraft());
    expect(draft.mode).toBe('manual');
    draft = toggleGoal(draft, 'booking', model);
    expect(draft).toMatchObject({ mode: 'guided', goals: ['booking'] });
    draft = toggleGoal(draft, 'booking', model);
    expect(draft.goals).toEqual([]);
  });

  it('allows at most the limit; the others are ignored until one is dropped', () => {
    let draft = emptyDraft();
    for (const goal of model.goals.slice(0, 4)) draft = toggleGoal(draft, goal.id, model);
    expect(draft.goals).toEqual(model.goals.slice(0, 3).map((goal) => goal.id));
    draft = toggleGoal(draft, model.goals[0]!.id, model);
    draft = toggleGoal(draft, model.goals[3]!.id, model);
    expect(draft.goals).toHaveLength(3);
    expect(draft.goals).toContain(model.goals[3]!.id);
  });

  it('"not sure" is exclusive both ways and clears the answers', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    draft = toggleGoal(draft, GOAL_UNSURE, model);
    expect(draft.goals).toEqual([GOAL_UNSURE]);
    expect(draft.answers).toEqual({});
    draft = toggleGoal(draft, 'less-routine', model);
    expect(draft.goals).toEqual(['less-routine']);
    draft = toggleGoal(draft, GOAL_UNSURE, model);
    expect(draft.goals).toEqual([GOAL_UNSURE]);
  });

  it('drops the answer of a deselected goal and ignores unknown goals', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    expect(toggleGoal(draft, 'nope', model)).toBe(draft);
    expect(toggleGoal(draft, 'booking', model).answers).toEqual({});
  });
});

describe('setAnswer', () => {
  it('records known options of picked goals only', () => {
    const picked = toggleGoal(emptyDraft(), 'booking', model);
    expect(setAnswer(picked, 'booking', 'phone', model).answers).toEqual({ booking: 'phone' });
    expect(setAnswer(picked, 'booking', 'nope', model)).toBe(picked);
    expect(setAnswer(picked, 'less-routine', 'documents', model)).toBe(picked);
  });

  it('changes the recommendation when the answer changes', () => {
    let draft = toggleGoal(emptyDraft(), 'client-order', model);
    draft = setAnswer(draft, 'client-order', 'program-inconvenient', model);
    expect(servicesOf(draft, model)).toEqual(['crm/custom-crm']);
    draft = setAnswer(draft, 'client-order', 'head-notebook', model);
    expect(servicesOf(draft, model)).toEqual(['crm/crm-implementation']);
  });
});

describe('toggleHave', () => {
  it('"nothing of these" is exclusive', () => {
    let draft = toggleHave(emptyDraft(), 'website', model);
    draft = toggleHave(draft, 'tracking', model);
    expect(draft.have).toEqual(['website', 'tracking']);
    draft = toggleHave(draft, HAVE_NONE, model);
    expect(draft.have).toEqual([HAVE_NONE]);
    draft = toggleHave(draft, 'social', model);
    expect(draft.have).toEqual(['social']);
    expect(toggleHave(draft, 'nope', model)).toBe(draft);
  });
});

describe('manual mode and picked services', () => {
  it('"I know what I need" clears goals and answers and keeps picked services', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    draft = addService(draft, 'web/landing-pages', model);
    const manual = chooseManual(draft);
    expect(manual).toMatchObject({
      mode: 'manual',
      goals: [],
      answers: {},
      added: ['web/landing-pages'],
    });
    expect(servicesOf(manual, model)).toEqual(['web/landing-pages']);
    expect(chooseGuided(manual).mode).toBe('guided');
  });

  it('removes a recommended service (kept apart) and a picked one (forgotten)', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    draft = addService(draft, 'web/landing-pages', model);
    draft = removeService(draft, 'telegram/booking', model);
    draft = removeService(draft, 'web/landing-pages', model);
    expect(draft.removed).toEqual(['telegram/booking', 'web/landing-pages']);
    expect(draft.added).toEqual([]);
    expect(servicesOf(draft, model)).toEqual(['automation/notifications-reminders']);
    expect(removeService(draft, 'web/ghost', model)).toBe(draft);
  });

  it('adding a removed recommended service brings it back; toggling flips', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'messengers', model);
    draft = removeService(draft, 'telegram/booking', model);
    expect(servicesOf(draft, model)).toEqual([]);
    draft = toggleService(draft, 'telegram/booking', model);
    expect(servicesOf(draft, model)).toEqual(['telegram/booking']);
    expect(draft.removed).toEqual([]);
    draft = toggleService(draft, 'telegram/booking', model);
    expect(servicesOf(draft, model)).toEqual([]);
    expect(addService(draft, 'web/ghost', model)).toBe(draft);
  });

  it('re-derives the recommendation when an answer changes, keeping the visitor’s edits', () => {
    let draft = toggleGoal(emptyDraft(), 'booking', model);
    draft = setAnswer(draft, 'booking', 'phone', model);
    draft = removeService(draft, 'automation/notifications-reminders', model);
    draft = addService(draft, 'crm/custom-crm', model);
    draft = setAnswer(draft, 'booking', 'messengers', model);
    expect(servicesOf(draft, model)).toEqual(['crm/custom-crm', 'telegram/booking']);
  });
});

describe('sanitizeDraft', () => {
  it('keeps a valid draft as it is', () => {
    const draft = { ...completeDraft(), contact: { name: 'Ola', comment: 'x' } };
    expect(sanitizeDraft(draft, model)).toEqual(draft);
  });

  it('never throws and falls back to an empty draft', () => {
    for (const value of [null, undefined, 5, 'x', [], { goals: 'oops', added: 4 }]) {
      expect(() => sanitizeDraft(value, model)).not.toThrow();
    }
    expect(sanitizeDraft(null, model)).toEqual(emptyDraft());
  });

  it('drops unknown goals, answers, services and options; enforces the limits', () => {
    const sanitized = sanitizeDraft(
      {
        mode: 'manual?',
        goals: ['booking', 'ghost', 'booking', 'less-routine', 'client-order', 'more-clients'],
        answers: { booking: 'nope', 'less-routine': 'documents', ghost: 'x' },
        have: ['website', 'ghost', 'website'],
        removed: ['web/ghost', 'telegram/booking'],
        added: ['web/landing-pages', 'web/ghost', 'web/landing-pages', 7],
        industry: 'ghost',
        industryOther: 'text',
        contact: { name: 5, comment: 'ok' },
      },
      model,
    );
    expect(sanitized).toEqual({
      mode: 'guided',
      goals: ['booking', 'less-routine', 'client-order'],
      answers: { 'less-routine': 'documents' },
      have: ['website'],
      removed: ['telegram/booking'],
      added: ['web/landing-pages'],
      industry: null,
      industryOther: '',
      contact: { name: '', comment: 'ok' },
    });
  });

  it('keeps "not sure" alone, "nothing of these" alone, and clips texts', () => {
    const sanitized = sanitizeDraft(
      {
        goals: [GOAL_UNSURE, 'booking'],
        have: [HAVE_NONE, 'website'],
        industry: 'other',
        industryOther: 'y'.repeat(100),
        contact: { name: 'n'.repeat(200), comment: 'c'.repeat(2000) },
      },
      model,
    );
    expect(sanitized.goals).toEqual([GOAL_UNSURE]);
    expect(sanitized.have).toEqual([HAVE_NONE]);
    expect(Array.from(sanitized.industryOther)).toHaveLength(60);
    expect(Array.from(sanitized.contact.name)).toHaveLength(model.limits.nameMax);
    expect(Array.from(sanitized.contact.comment)).toHaveLength(model.limits.commentMax);
  });

  it('manual mode has no goals, answers or removed services', () => {
    const sanitized = sanitizeDraft(
      {
        mode: 'manual',
        goals: ['booking'],
        answers: { booking: 'phone' },
        removed: ['web/landing-pages'],
        added: ['crm/custom-crm'],
      },
      model,
    );
    expect(sanitized).toMatchObject({
      mode: 'manual',
      goals: [],
      answers: {},
      removed: [],
      added: ['crm/custom-crm'],
    });
  });

  it('leaves out the budget and timeline of a v2 draft (D155)', () => {
    const sanitized = sanitizeDraft(
      { mode: 'manual', added: ['web/landing-pages'], budget: 'up-to-1500', timeline: 'asap' },
      model,
    );
    expect(sanitized).not.toHaveProperty('budget');
    expect(sanitized).not.toHaveProperty('timeline');
    expect(configuratorDraftSchema.safeParse(sanitized).success).toBe(true);
  });

  it('always produces a draft that matches the schema', () => {
    for (const value of [null, completeDraft(), { goals: [GOAL_UNSURE], added: ['x'] }]) {
      expect(configuratorDraftSchema.safeParse(sanitizeDraft(value, model)).success).toBe(true);
    }
  });
});

describe('prefillDraft and refsFromSearch', () => {
  it('turns known service refs into picked services; unknown ones are ignored', () => {
    const draft = prefillDraft(
      emptyDraft(),
      ['crm/custom-crm', 'web/landing-pages', 'web/landing-pages', 'nope/x', 'web/seo'],
      model,
    );
    expect(draft.added).toEqual(['crm/custom-crm', 'web/landing-pages']);
  });

  it('parses repeated and comma-separated add= parameters', () => {
    expect(refsFromSearch('?add=web/a,crm/b&add=ai/c&add=web/a')).toEqual([
      'web/a',
      'crm/b',
      'ai/c',
    ]);
    expect(refsFromSearch('?utm=1')).toEqual([]);
  });
});
