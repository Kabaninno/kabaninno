import { CONFIGURATOR_STEPS, type ConfiguratorStepId } from '../configurator-steps';
import { INDUSTRY_OTHER_MAX } from './draft';
import type { LeadLabels } from './message';
import {
  BUDGET_NOT_SURE,
  OPTION_UNKNOWN,
  allServices,
  type BudgetRange,
  type ConfiguratorModel,
} from './model';

/**
 * Every string the configurator wizard shows, resolved on the server for one
 * locale and passed to the client as plain props: the client never formats
 * ICU messages (no Intl initialisation during hydration, P-08) and never
 * imports dictionaries or the content layer (D05, D09). The few texts with an
 * argument that depends on the visitor's choices are templates with `{name}`
 * placeholders, filled on the client by `fillTemplate`.
 */

/** A translator for one namespace (next-intl's server `t`, or a test double). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface CategoryLabel {
  name: string;
  /** DNA accent (#RRGGBB). */
  color: string;
}

export interface WizardLabels {
  /** Short names of the steps (shown above the progress bar). */
  steps: Record<ConfiguratorStepId, string>;
  /** The step's heading. */
  titles: Record<ConfiguratorStepId, string>;
  hints: Record<ConfiguratorStepId, string>;
  /** "Krok 3 z 5" per step index, for the guided flow and for the manual one (no details step). */
  progress: { guided: string[]; manual: string[] };
  nav: {
    back: string;
    next: string;
    edit: string;
    startOver: string;
    startOverConfirm: string;
    startOverYes: string;
    startOverNo: string;
  };
  goals: {
    legend: string;
    /** "Pick up to 3." */
    hint: string;
    unsure: string;
    /** The link under the list: skip the questions and pick services yourself. */
    knowIt: string;
    /** By goal id. */
    names: Record<string, string>;
  };
  details: {
    /** Under the title when the goal is "not sure": only the shared question follows. */
    unsureNote: string;
    /** The question of each goal, by goal id. */
    questions: Record<string, string>;
    /** Option labels by goal id and option id. */
    options: Record<string, Record<string, string>>;
    haveLegend: string;
    haveHint: string;
    have: Record<string, string>;
  };
  solution: {
    /** Template "You'll be well served by: {combo}". */
    fits: string;
    /** Instead of services: the consultation. */
    consultation: string;
    /** "Remove", and its accessible name template "Remove: {service}". */
    remove: string;
    removeNamed: string;
    addMore: string;
    hideList: string;
    /** Legend of the full list of services. */
    listLegend: string;
    /** Manual mode: the visitor picks, with a way back to the questions. */
    manualHint: string;
    backToGuided: string;
    /** By service id `"<category>/<slug>"`: one line in plain words. */
    benefits: Record<string, string>;
  };
  plan: {
    budget: string;
    timeline: string;
    industry: string;
    industryHint: string;
    industryOther: string;
    industryOtherHint: string;
  };
  fields: {
    name: string;
    nameHint: string;
    comment: string;
    commentHint: string;
  };
  categories: Record<string, CategoryLabel>;
  /** By service id `"<category>/<slug>"`. */
  services: Record<string, string>;
  industries: Record<string, string>;
  budgets: Record<string, string>;
  timelines: Record<string, string>;
  /** Field error messages, already formatted with their limits. */
  errors: {
    requiredMulti: string;
    requiredOne: string;
    requiredText: string;
    nameTooShort: string;
    nameTooLong: string;
    commentTooLong: string;
    industryTooLong: string;
    unknown: string;
  };
  prefilled: string;
  /** The budget range was cleared after the selection changed (D138). */
  budgetReset: string;
  summary: {
    choices: string;
    message: string;
    messageHint: string;
    restoreDefault: string;
    send: string;
    copy: string;
    copied: string;
    copyFailed: string;
    /** Under "Send via Telegram": the text is already copied (D135). */
    sendHint: string;
    newTab: string;
    truncated: string;
    unconfigured: string;
    /** The answers changed after the visitor edited the message (Q-F3-01). */
    staleNotice: string;
    staleUpdate: string;
    staleKeep: string;
    /** Results of a non-link submitter (`ApiSubmitter`, later). */
    sent: string;
    sendFailed: string;
    /** Rows of the answers list. */
    rowGoals: string;
    rowHave: string;
    rowServices: string;
    rowBudget: string;
    rowTimeline: string;
    rowIndustry: string;
    /** The consultation, when there are no services. */
    rowConsultation: string;
  };
  /** Words of the lead message itself (`message.ts`). */
  lead: LeadLabels;
}

export interface WizardLabelSources {
  locale: string;
  model: ConfiguratorModel;
  /** `configurator` namespace. */
  t: Translate;
  /** `lead` namespace. */
  tLead: Translate;
  studio: string;
  category: (id: string) => CategoryLabel;
  serviceTitle: (categoryId: string, slug: string) => string;
  /** One line "what this service gives you" (content text `benefit`). */
  serviceBenefit: (categoryId: string, slug: string) => string;
}

/** Fills `{name}` placeholders of a pre-translated template (no ICU on the client). */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** "5 000–15 000 PLN" style range label from the locale's templates. */
export function formatBudgetLabel(
  range: BudgetRange,
  locale: string,
  currency: string,
  t: Translate,
): string {
  const amount = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: 'always' }).format(
      value,
    );
  if (range.min !== undefined && range.max !== undefined) {
    return t('budget.range', { min: amount(range.min), max: amount(range.max), currency });
  }
  if (range.max !== undefined) return t('budget.upTo', { max: amount(range.max), currency });
  return t('budget.from', { min: amount(range.min ?? 0), currency });
}

const byId = (ids: readonly string[], label: (id: string) => string): Record<string, string> =>
  Object.fromEntries(ids.map((id) => [id, label(id)]));

export function buildWizardLabels({
  locale,
  model,
  t,
  tLead,
  studio,
  category,
  serviceTitle,
  serviceBenefit,
}: WizardLabelSources): WizardLabels {
  const steps = byId(CONFIGURATOR_STEPS, (step) => t(`steps.${step}`)) as WizardLabels['steps'];
  const categories = Object.fromEntries(model.categories.map((id) => [id, category(id)]));
  const services = Object.fromEntries(
    allServices(model).map((service) => [service.id, serviceTitle(service.category, service.slug)]),
  );
  const benefits = Object.fromEntries(
    allServices(model).map((service) => [
      service.id,
      serviceBenefit(service.category, service.slug),
    ]),
  );
  const industries = byId(model.industries, (id) => t(`industries.${id}`));
  const timelines = byId(model.timelines, (id) => t(`timelines.${id}`));
  const budgets = {
    ...Object.fromEntries(
      model.budgetRanges.map((range) => [
        range.id,
        formatBudgetLabel(range, locale, model.currency, t),
      ]),
    ),
    [BUDGET_NOT_SURE]: t('budget.notSure'),
  };
  const goalNames = byId(
    model.goals.map((goal) => goal.id),
    (id) => t(`goals.items.${id}.name`),
  );
  const questions = byId(
    model.goals.map((goal) => goal.id),
    (id) => t(`goals.items.${id}.question`),
  );
  // "I don't know" is one shared wording; the other options are the goal's own.
  const options = Object.fromEntries(
    model.goals.map((goal) => [
      goal.id,
      byId(
        goal.options.map((option) => option.id),
        (id) =>
          id === OPTION_UNKNOWN
            ? t('goals.unknownOption')
            : t(`goals.items.${goal.id}.options.${id}`),
      ),
    ]),
  );
  const have = byId(model.have, (id) => t(`have.items.${id}`));
  const progress = (total: number) =>
    Array.from({ length: total }, (_, index) => t('progress', { current: index + 1, total }));
  const guidedCount = CONFIGURATOR_STEPS.length;
  return {
    steps,
    titles: byId(CONFIGURATOR_STEPS, (step) => t(`titles.${step}`)) as WizardLabels['titles'],
    hints: byId(CONFIGURATOR_STEPS, (step) => t(`hints.${step}`)) as WizardLabels['hints'],
    progress: { guided: progress(guidedCount), manual: progress(guidedCount - 1) },
    nav: {
      back: t('nav.back'),
      next: t('nav.next'),
      edit: t('nav.edit'),
      startOver: t('nav.startOver'),
      startOverConfirm: t('nav.startOverConfirm'),
      startOverYes: t('nav.startOverYes'),
      startOverNo: t('nav.startOverNo'),
    },
    goals: {
      legend: t('goals.legend'),
      hint: t('goals.hint', { max: model.maxGoals }),
      unsure: t('goals.unsure'),
      knowIt: t('goals.knowIt'),
      names: goalNames,
    },
    details: {
      unsureNote: t('details.unsureNote'),
      questions,
      options,
      haveLegend: t('have.legend'),
      haveHint: t('have.hint'),
      have,
    },
    solution: {
      // Templates for the client: the argument is given back as its own placeholder (see `fillTemplate`).
      fits: t('solution.fits', { combo: '{combo}' }),
      consultation: t('solution.consultation'),
      remove: t('solution.remove'),
      removeNamed: t('solution.removeNamed', { service: '{service}' }),
      addMore: t('solution.addMore'),
      hideList: t('solution.hideList'),
      listLegend: t('solution.listLegend'),
      manualHint: t('solution.manualHint'),
      backToGuided: t('solution.backToGuided'),
      benefits,
    },
    plan: {
      budget: t('plan.budget'),
      timeline: t('plan.timeline'),
      industry: t('plan.industry'),
      industryHint: t('plan.industryHint'),
      industryOther: t('plan.industryOther'),
      industryOtherHint: t('plan.industryOtherHint', { max: INDUSTRY_OTHER_MAX }),
    },
    fields: {
      name: t('fields.name'),
      nameHint: t('fields.nameHint'),
      comment: t('fields.comment'),
      commentHint: t('fields.commentHint', { max: model.limits.commentMax }),
    },
    categories,
    services,
    industries,
    budgets,
    timelines,
    errors: {
      requiredMulti: t('errors.requiredMulti'),
      requiredOne: t('errors.requiredOne'),
      requiredText: t('errors.requiredText'),
      nameTooShort: t('errors.tooShort', { min: model.limits.nameMin }),
      nameTooLong: t('errors.tooLong', { max: model.limits.nameMax }),
      commentTooLong: t('errors.tooLong', { max: model.limits.commentMax }),
      industryTooLong: t('errors.tooLong', { max: INDUSTRY_OTHER_MAX }),
      unknown: t('errors.unknown'),
    },
    prefilled: t('prefilled'),
    budgetReset: t('budget.reset'),
    summary: {
      choices: t('summary.choices'),
      message: t('summary.message'),
      messageHint: t('summary.messageHint'),
      restoreDefault: t('summary.restoreDefault'),
      send: t('summary.send'),
      copy: t('summary.copy'),
      copied: t('summary.copied'),
      copyFailed: t('summary.copyFailed'),
      sendHint: t('summary.sendHint'),
      newTab: t('summary.newTab'),
      truncated: t('summary.truncated'),
      unconfigured: t('summary.unconfigured'),
      staleNotice: t('summary.staleNotice'),
      staleUpdate: t('summary.staleUpdate'),
      staleKeep: t('summary.staleKeep'),
      sent: t('summary.sent'),
      sendFailed: t('summary.sendFailed'),
      rowGoals: t('summary.rowGoals'),
      rowHave: t('summary.rowHave'),
      rowServices: t('summary.rowServices'),
      rowBudget: t('summary.rowBudget'),
      rowTimeline: t('summary.rowTimeline'),
      rowIndustry: t('summary.rowIndustry'),
      rowConsultation: t('summary.rowConsultation'),
    },
    lead: {
      title: tLead('title', { studio }),
      goals: tLead('goals'),
      have: tLead('have'),
      solution: tLead('solution'),
      services: tLead('services'),
      industry: tLead('industry'),
      budget: tLead('budget'),
      timeline: tLead('timeline'),
      name: tLead('name'),
      comment: tLead('comment'),
      unsure: tLead('unsure'),
      consultation: tLead('consultation'),
      goalNames,
      answers: options,
      haveNames: have,
      categories: Object.fromEntries(
        Object.entries(categories).map(([id, label]) => [id, label.name]),
      ),
      serviceNames: services,
      industries,
      budgets,
      timelines,
    },
  };
}

/** The message for a field error (`validateStep` code → wizard text). */
export function errorText(
  field: string,
  code: 'required' | 'tooShort' | 'tooLong' | 'unknown',
  errors: WizardLabels['errors'],
): string {
  switch (code) {
    case 'required':
      if (field === 'goals') return errors.requiredMulti;
      if (field === 'contact.name') return errors.requiredText;
      return errors.requiredOne;
    case 'tooShort':
      return errors.nameTooShort;
    case 'tooLong':
      if (field === 'industry') return errors.industryTooLong;
      return field === 'contact.comment' ? errors.commentTooLong : errors.nameTooLong;
    case 'unknown':
      return errors.unknown;
  }
}
