/**
 * The configurator's stored draft for specs (D149, round 3 D155). The ids come
 * from the content layer and `content/configurator.ts`; the draft leads to an
 * online store and a custom CRM (estimate 3 500–7 000 zł, 2–5 weeks).
 */
export const CONFIGURATOR_KEY = 'kabaninno.configurator.v2';

export const DRAFT = {
  mode: 'guided',
  industry: 'retail',
  industryOther: '',
  goals: ['online-orders', 'client-order'],
  answers: { 'online-orders': '20-200', 'client-order': 'program-inconvenient' },
  have: ['website'],
  removed: [],
  added: [],
  contact: { name: 'Łucja Żółkiewska', comment: 'Sklep z integracją CRM.' },
};

/** What the wizard stores: the draft and the step it was on (storage version 3). */
export function storedConfigurator(step: string, draft: object = DRAFT) {
  return { v: 3, step, draft };
}

/** Service ids the draft above leads to, in content order. */
export const DRAFT_SERVICES = ['web/online-stores', 'crm/custom-crm'] as const;
