import { describe, expect, it } from 'vitest';
import { emptyDraft, type ConfiguratorDraft } from './draft';
import { GOAL_UNSURE, getConfiguratorModel } from './model';
import { categoriesOf, recommendedServices, selectedServices } from './recommend';

const model = getConfiguratorModel();

const draftWith = (patch: Partial<ConfiguratorDraft>): ConfiguratorDraft => ({
  ...emptyDraft(),
  ...patch,
});

describe('recommendedServices', () => {
  it('maps one goal and its answer to the services of the brief (D149)', () => {
    const draft = draftWith({ goals: ['more-clients'], answers: { 'more-clients': 'google' } });
    expect(recommendedServices(model, draft)).toEqual(['web/corporate-websites']);
  });

  it('recommends nothing before a goal is answered, for "unsure" and in manual mode', () => {
    expect(recommendedServices(model, emptyDraft())).toEqual([]);
    expect(recommendedServices(model, draftWith({ goals: ['booking'] }))).toEqual([]);
    expect(recommendedServices(model, draftWith({ goals: [GOAL_UNSURE] }))).toEqual([]);
    expect(
      recommendedServices(
        model,
        draftWith({ mode: 'manual', goals: ['booking'], answers: { booking: 'phone' } }),
      ),
    ).toEqual([]);
  });

  it('takes the services rank by rank across goals and counts duplicates once', () => {
    const draft = draftWith({
      goals: ['online-orders', 'booking', 'client-order'],
      answers: {
        'online-orders': 'over-200', // store, api-integrations
        booking: 'phone', // booking bot, notifications
        'client-order': 'spreadsheets', // crm, api-integrations (again)
      },
    });
    // First services of every goal, then the seconds; the repeated API integration counts once;
    // the limit of four cuts the last.
    expect(recommendedServices(model, draft)).toEqual([
      'web/online-stores',
      'telegram/booking',
      'crm/crm-implementation',
      'automation/api-integrations',
    ]);
  });

  it('never exceeds the limit', () => {
    const draft = draftWith({
      goals: ['fast-replies', 'booking', 'less-routine'],
      answers: {
        'fast-replies': 'many-channels',
        booking: 'website-inconvenient',
        'less-routine': 'documents',
      },
    });
    expect(recommendedServices(model, draft).length).toBeLessThanOrEqual(model.maxRecommended);
  });
});

describe('selectedServices', () => {
  const base = draftWith({
    goals: ['booking'],
    answers: { booking: 'phone' },
  });

  it('is the recommendation, in content order', () => {
    expect(selectedServices(model, base)).toEqual([
      'automation/notifications-reminders',
      'telegram/booking',
    ]);
  });

  it('drops what the visitor removed and adds what they picked', () => {
    const draft = {
      ...base,
      removed: ['telegram/booking'],
      added: ['web/landing-pages'],
    };
    expect(selectedServices(model, draft)).toEqual([
      'web/landing-pages',
      'automation/notifications-reminders',
    ]);
  });

  it('keeps picked services in the manual mode, where nothing is recommended', () => {
    const draft = draftWith({ mode: 'manual', added: ['crm/custom-crm', 'web/landing-pages'] });
    expect(selectedServices(model, draft)).toEqual(['web/landing-pages', 'crm/custom-crm']);
  });

  it('counts a service that is both recommended and picked once', () => {
    const draft = { ...base, added: ['telegram/booking'] };
    expect(selectedServices(model, draft)).toEqual([
      'automation/notifications-reminders',
      'telegram/booking',
    ]);
  });
});

describe('categoriesOf', () => {
  it('lists the categories of the services in content order, once each', () => {
    expect(
      categoriesOf(model, ['telegram/booking', 'web/landing-pages', 'telegram/sales-orders']),
    ).toEqual(['web', 'telegram']);
    expect(categoriesOf(model, [])).toEqual([]);
  });
});
