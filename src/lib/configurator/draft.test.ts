import { describe, expect, it } from 'vitest';
import { CONFIGURATOR_STEPS } from '../configurator-steps';
import {
  canEnterStep,
  configuratorDraftSchema,
  emptyDraft,
  firstInvalidStep,
  furthestEnterableStep,
  prefillDraft,
  refsFromSearch,
  sanitizeDraft,
  toggleFeature,
  toggleType,
  validateStep,
  type ConfiguratorDraft,
} from './draft';
import { BUDGET_NOT_SURE, getConfiguratorModel } from './model';

const model = getConfiguratorModel();

function completeDraft(): ConfiguratorDraft {
  return {
    types: ['web', 'crm'],
    features: ['web/landing-pages', 'crm/custom-crm', 'web/seo'],
    business: { industry: 'retail', size: '2-10', hasWebsite: 'yes', hasCrm: 'no' },
    budget: '15k-40k',
    timeline: '1-3-months',
    contact: { name: '  Ola  ', comment: 'Potrzebujemy sklepu z integracją CRM.' },
  };
}

describe('validateStep', () => {
  it('accepts a complete draft on every step', () => {
    for (const step of CONFIGURATOR_STEPS)
      expect(validateStep(step, completeDraft(), model)).toEqual({});
  });

  it('type: at least one known category', () => {
    expect(validateStep('type', emptyDraft(), model)).toEqual({ types: 'required' });
    expect(validateStep('type', { ...emptyDraft(), types: ['nope'] }, model)).toEqual({
      types: 'unknown',
    });
  });

  it('features: at least one feature of the selected categories', () => {
    const draft = { ...completeDraft(), features: [] };
    expect(validateStep('features', draft, model)).toEqual({ features: 'required' });
    const orphan = { ...completeDraft(), types: ['ai'], features: ['web/seo'] };
    expect(validateStep('features', orphan, model)).toEqual({ features: 'required' });
  });

  it('business: every field answered with known ids', () => {
    expect(validateStep('business', emptyDraft(), model)).toEqual({
      'business.industry': 'required',
      'business.size': 'required',
      'business.hasWebsite': 'required',
      'business.hasCrm': 'required',
    });
    const draft = completeDraft();
    draft.business.industry = 'nope';
    expect(validateStep('business', draft, model)).toEqual({ 'business.industry': 'unknown' });
  });

  it('budget: a range or "not sure"; timeline: a known option', () => {
    expect(validateStep('budget', emptyDraft(), model)).toEqual({ budget: 'required' });
    expect(validateStep('budget', { ...completeDraft(), budget: BUDGET_NOT_SURE }, model)).toEqual(
      {},
    );
    expect(validateStep('budget', { ...completeDraft(), budget: '1m-plus' }, model)).toEqual({
      budget: 'unknown',
    });
    expect(validateStep('timeline', emptyDraft(), model)).toEqual({ timeline: 'required' });
  });

  it('contact: trimmed name within limits, optional comment within its limit', () => {
    const at = (name: string, comment = '') =>
      validateStep('contact', { ...completeDraft(), contact: { name, comment } }, model);
    expect(at('   ')).toEqual({ 'contact.name': 'required' });
    expect(at(' A ')).toEqual({ 'contact.name': 'tooShort' });
    expect(at('Ł'.repeat(model.limits.nameMax))).toEqual({});
    expect(at('Ł'.repeat(model.limits.nameMax + 1))).toEqual({ 'contact.name': 'tooLong' });
    expect(at('Ола', 'я'.repeat(model.limits.commentMax))).toEqual({});
    expect(at('Ола', 'я'.repeat(model.limits.commentMax + 1))).toEqual({
      'contact.comment': 'tooLong',
    });
  });
});

describe('canEnterStep', () => {
  it('earlier steps are always reachable', () => {
    expect(canEnterStep('type', emptyDraft(), model)).toBe(true);
  });

  it('a later step needs every previous step valid', () => {
    const draft = completeDraft();
    expect(canEnterStep('summary', draft, model)).toBe(true);
    draft.business.size = null;
    expect(canEnterStep('budget', draft, model)).toBe(false);
    expect(canEnterStep('business', draft, model)).toBe(true);
    expect(firstInvalidStep(draft, model)).toBe('business');
    expect(furthestEnterableStep(draft, model)).toBe('business');
  });

  it('a complete draft can go straight to the summary', () => {
    expect(firstInvalidStep(completeDraft(), model)).toBeNull();
    expect(furthestEnterableStep(completeDraft(), model)).toBe('summary');
  });
});

describe('toggleType / toggleFeature', () => {
  it('keeps types in model order and drops features of a deselected type', () => {
    let draft = toggleType(emptyDraft(), 'crm', model);
    draft = toggleType(draft, 'web', model);
    expect(draft.types).toEqual(['web', 'crm']);
    draft = toggleFeature(draft, 'web/landing-pages', model);
    draft = toggleFeature(draft, 'crm/custom-crm', model);
    draft = toggleType(draft, 'web', model);
    expect(draft.types).toEqual(['crm']);
    expect(draft.features).toEqual(['crm/custom-crm']);
  });

  it('ignores unknown ids and features of unselected types', () => {
    const draft = toggleType(emptyDraft(), 'web', model);
    expect(toggleType(draft, 'nope', model)).toBe(draft);
    expect(toggleFeature(draft, 'crm/custom-crm', model)).toBe(draft);
    expect(toggleFeature(draft, 'web/nope', model)).toBe(draft);
  });
});

describe('sanitizeDraft', () => {
  it('passes a valid draft through unchanged', () => {
    expect(sanitizeDraft(completeDraft(), model)).toEqual(completeDraft());
  });

  it('drops unknown and stale ids, wrong types and over-long texts', () => {
    const sanitized = sanitizeDraft(
      {
        types: ['web', 'removed', 42],
        features: ['web/seo', 'web/removed', 'crm/custom-crm', 'web/seo'],
        business: { industry: 'mining', size: '2-10', hasWebsite: true, hasCrm: 'no' },
        budget: 'millions',
        timeline: 'asap',
        contact: { name: 'x'.repeat(500), comment: 7 },
      },
      model,
    );
    expect(sanitized).toEqual({
      types: ['web'],
      features: ['web/seo'],
      business: { industry: null, size: '2-10', hasWebsite: null, hasCrm: 'no' },
      budget: null,
      timeline: 'asap',
      contact: { name: 'x'.repeat(model.limits.nameMax), comment: '' },
    });
    expect(configuratorDraftSchema.safeParse(sanitized).success).toBe(true);
  });

  it('turns garbage into an empty draft', () => {
    for (const value of [null, 'draft', 42, [], { types: 'web' }]) {
      expect(configuratorDraftSchema.safeParse(sanitizeDraft(value, model)).success).toBe(true);
    }
    expect(sanitizeDraft(null, model)).toEqual(emptyDraft());
  });
});

describe('prefill from «Add to request»', () => {
  it('selects the category and the service for each known ref', () => {
    const draft = prefillDraft(emptyDraft(), ['crm/custom-crm', 'web/landing-pages'], model);
    expect(draft.types).toEqual(['web', 'crm']);
    expect(draft.features).toEqual(['crm/custom-crm', 'web/landing-pages']);
  });

  it('ignores unknown refs and extra-feature ids, and does not duplicate', () => {
    const start = prefillDraft(emptyDraft(), ['web/landing-pages'], model);
    const draft = prefillDraft(start, ['web/landing-pages', 'web/seo', 'nope/x', 'web'], model);
    expect(draft.types).toEqual(['web']);
    expect(draft.features).toEqual(['web/landing-pages']);
  });

  it('reads ?add= refs (repeated or comma-separated)', () => {
    expect(refsFromSearch('?add=web%2Flanding-pages')).toEqual(['web/landing-pages']);
    expect(refsFromSearch('add=web/landing-pages&add=crm/custom-crm,ai/ai-assistants')).toEqual([
      'web/landing-pages',
      'crm/custom-crm',
      'ai/ai-assistants',
    ]);
    expect(refsFromSearch(new URLSearchParams('add= &x=1'))).toEqual([]);
  });
});
