/**
 * The configurator's stored draft for specs (D149). The ids come from the
 * content layer and `content/configurator.ts`; the services this draft leads
 * to (online stores, custom CRM) are of complexity level 3, so its budget id
 * `5000-10000` is valid.
 */
export const CONFIGURATOR_KEY = 'kabaninno.configurator.v2';

export const DRAFT = {
  mode: 'guided',
  goals: ['online-orders', 'client-order'],
  answers: { 'online-orders': '20-200', 'client-order': 'program-inconvenient' },
  have: ['website'],
  removed: [],
  added: [],
  industry: 'retail',
  industryOther: '',
  budget: '5000-10000',
  timeline: '1-3-months',
  contact: { name: 'Łucja Żółkiewska', comment: 'Sklep z integracją CRM.' },
};

/** What the wizard stores: the draft and the step it was on. */
export function storedConfigurator(step: string, draft: object = DRAFT) {
  return { v: 2, step, draft };
}

/** Service ids the draft above leads to, in content order. */
export const DRAFT_SERVICES = ['web/online-stores', 'crm/custom-crm'] as const;
