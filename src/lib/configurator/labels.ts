import { CONFIGURATOR_STEPS, type ConfiguratorStepId } from '../configurator-steps';
import type { LeadLabels } from './message';
import { BUDGET_NOT_SURE, type BudgetRange, type ConfiguratorModel } from './model';

/**
 * Every string the configurator wizard shows, resolved on the server for one
 * locale and passed to the client as plain props: the client never formats
 * ICU messages (no Intl initialisation during hydration, P-08) and never
 * imports dictionaries or the content layer (D05, D09).
 */

/** A translator for one namespace (next-intl's server `t`, or a test double). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface CategoryLabel {
  name: string;
  /** DNA accent (#RRGGBB). */
  color: string;
}

export interface WizardLabels {
  steps: Record<ConfiguratorStepId, string>;
  hints: Record<ConfiguratorStepId, string>;
  /** "Krok 3 z 7" per step index. */
  progress: string[];
  stepsNav: string;
  nav: {
    back: string;
    next: string;
    toSummary: string;
    edit: string;
    startOver: string;
    startOverConfirm: string;
    startOverYes: string;
    startOverNo: string;
  };
  fields: {
    types: string;
    features: string;
    industry: string;
    size: string;
    hasWebsite: string;
    hasCrm: string;
    budget: string;
    timeline: string;
    name: string;
    nameHint: string;
    comment: string;
    commentHint: string;
  };
  yes: string;
  no: string;
  categories: Record<string, CategoryLabel>;
  /** By feature id `"<category>/<key>"`. */
  features: Record<string, string>;
  industries: Record<string, string>;
  sizes: Record<string, string>;
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
    unknown: string;
  };
  prefilled: string;
  summary: {
    choices: string;
    message: string;
    messageHint: string;
    restoreDefault: string;
    send: string;
    copy: string;
    copied: string;
    copyFailed: string;
    openChat: string;
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
}

/** "5 000–15 000 PLN" style range label from the locale's templates. */
export function formatBudgetLabel(
  range: BudgetRange,
  locale: string,
  currency: string,
  t: Translate,
): string {
  const amount = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
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
}: WizardLabelSources): WizardLabels {
  const steps = byId(CONFIGURATOR_STEPS, (step) => t(`steps.${step}`)) as WizardLabels['steps'];
  const categories = Object.fromEntries(model.types.map((id) => [id, category(id)]));
  const features = Object.fromEntries(
    Object.values(model.features)
      .flat()
      .map((feature) => [
        feature.id,
        feature.kind === 'service'
          ? serviceTitle(feature.category, feature.key)
          : t(`extras.${feature.key}`),
      ]),
  );
  const industries = byId(model.industries, (id) => t(`industries.${id}`));
  const sizes = byId(model.companySizes, (id) => t(`sizes.${id}`));
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
  const yes = t('yes');
  const no = t('no');
  return {
    steps,
    hints: byId(CONFIGURATOR_STEPS, (step) => t(`hints.${step}`)) as WizardLabels['hints'],
    progress: CONFIGURATOR_STEPS.map((_, index) =>
      t('progress', { current: index + 1, total: CONFIGURATOR_STEPS.length }),
    ),
    stepsNav: t('stepsNav'),
    nav: {
      back: t('nav.back'),
      next: t('nav.next'),
      toSummary: t('nav.toSummary'),
      edit: t('nav.edit'),
      startOver: t('nav.startOver'),
      startOverConfirm: t('nav.startOverConfirm'),
      startOverYes: t('nav.startOverYes'),
      startOverNo: t('nav.startOverNo'),
    },
    fields: {
      types: t('fields.types'),
      features: t('fields.features'),
      industry: t('fields.industry'),
      size: t('fields.size'),
      hasWebsite: t('fields.hasWebsite'),
      hasCrm: t('fields.hasCrm'),
      budget: t('fields.budget'),
      timeline: t('fields.timeline'),
      name: t('fields.name'),
      nameHint: t('fields.nameHint'),
      comment: t('fields.comment'),
      commentHint: t('fields.commentHint', { max: model.limits.commentMax }),
    },
    yes,
    no,
    categories,
    features,
    industries,
    sizes,
    budgets,
    timelines,
    errors: {
      requiredMulti: t('errors.requiredMulti'),
      requiredOne: t('errors.requiredOne'),
      requiredText: t('errors.requiredText'),
      nameTooShort: t('errors.tooShort', { min: model.limits.nameMin }),
      nameTooLong: t('errors.tooLong', { max: model.limits.nameMax }),
      commentTooLong: t('errors.tooLong', { max: model.limits.commentMax }),
      unknown: t('errors.unknown'),
    },
    prefilled: t('prefilled'),
    summary: {
      choices: t('summary.choices'),
      message: t('summary.message'),
      messageHint: t('summary.messageHint'),
      restoreDefault: t('summary.restoreDefault'),
      send: t('summary.send'),
      copy: t('summary.copy'),
      copied: t('summary.copied'),
      copyFailed: t('summary.copyFailed'),
      openChat: t('summary.openChat'),
      newTab: t('summary.newTab'),
      truncated: t('summary.truncated'),
      unconfigured: t('summary.unconfigured'),
      staleNotice: t('summary.staleNotice'),
      staleUpdate: t('summary.staleUpdate'),
      staleKeep: t('summary.staleKeep'),
      sent: t('summary.sent'),
      sendFailed: t('summary.sendFailed'),
    },
    lead: {
      title: tLead('title', { studio }),
      types: tLead('types'),
      features: tLead('features'),
      business: tLead('business'),
      website: tLead('website'),
      crm: tLead('crm'),
      budget: tLead('budget'),
      timeline: tLead('timeline'),
      name: tLead('name'),
      comment: tLead('comment'),
      yes: tLead('yes'),
      no: tLead('no'),
      categories: Object.fromEntries(
        Object.entries(categories).map(([id, label]) => [id, label.name]),
      ),
      featureNames: features,
      industries,
      sizes,
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
      if (field === 'types' || field === 'features') return errors.requiredMulti;
      if (field === 'contact.name') return errors.requiredText;
      return errors.requiredOne;
    case 'tooShort':
      return errors.nameTooShort;
    case 'tooLong':
      return field === 'contact.comment' ? errors.commentTooLong : errors.nameTooLong;
    case 'unknown':
      return errors.unknown;
  }
}
