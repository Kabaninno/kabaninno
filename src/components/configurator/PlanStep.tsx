'use client';

import type { ConfiguratorDraft } from '@/lib/configurator/draft';
import { INDUSTRY_OTHER_MAX } from '@/lib/configurator/draft';
import type { WizardLabels } from '@/lib/configurator/labels';
import { budgetIds, type ConfiguratorModel } from '@/lib/configurator/model';
import {
  ChipGroup,
  FieldError,
  OptionGroup,
  describedBy,
  fieldDomId,
  inputBorder,
  inputClass,
} from './fields';

interface PlanStepProps {
  model: ConfiguratorModel;
  labels: WizardLabels;
  draft: ConfiguratorDraft;
  /** The services the request is about: they decide the budget ranges (D138). */
  services: readonly string[];
  update: (next: ConfiguratorDraft) => void;
  errorFor: (field: string) => string | undefined;
  /** The chosen range was cleared because the services moved to another level. */
  budgetReset: boolean;
}

/**
 * Step 4: the budget ranges of the request's complexity level (plus "not sure
 * yet — help me estimate"), when to start, and the optional industry as chips
 * ("Other" asks for a few words).
 */
export function PlanStep({
  model,
  labels,
  draft,
  services,
  update,
  errorFor,
  budgetReset,
}: PlanStepProps) {
  const otherId = fieldDomId('industryOther');
  return (
    <div className="flex flex-col gap-7">
      <OptionGroup
        field="budget"
        legend={labels.plan.budget}
        type="radio"
        options={budgetIds(model, services).map((id) => ({
          value: id,
          label: labels.budgets[id] ?? id,
        }))}
        selected={draft.budget ? [draft.budget] : []}
        onToggle={(id) => update({ ...draft, budget: id })}
        error={errorFor('budget')}
      >
        {budgetReset && draft.budget === null ? (
          <p role="status" className="mb-3 text-sm leading-relaxed text-[#ffd79a]">
            {labels.budgetReset}
          </p>
        ) : null}
      </OptionGroup>

      <OptionGroup
        field="timeline"
        legend={labels.plan.timeline}
        type="radio"
        options={model.timelines.map((id) => ({ value: id, label: labels.timelines[id] ?? id }))}
        selected={draft.timeline ? [draft.timeline] : []}
        onToggle={(id) => update({ ...draft, timeline: id })}
        error={errorFor('timeline')}
      />

      <div>
        <ChipGroup
          field="industry"
          legend={labels.plan.industry}
          hint={labels.plan.industryHint}
          options={model.industries.map((id) => ({
            value: id,
            label: labels.industries[id] ?? id,
          }))}
          value={draft.industry}
          onChange={(industry) =>
            update({
              ...draft,
              industry,
              industryOther: industry === 'other' ? draft.industryOther : '',
            })
          }
          error={draft.industry !== 'other' ? errorFor('industry') : undefined}
        />
        {draft.industry === 'other' ? (
          <div className="mt-4">
            <label htmlFor={otherId} className="text-sm font-medium text-ink">
              {labels.plan.industryOther}
            </label>
            <p id={`${otherId}-hint`} className="mt-1 text-sm text-muted">
              {labels.plan.industryOtherHint}
            </p>
            <input
              id={otherId}
              type="text"
              maxLength={INDUSTRY_OTHER_MAX}
              value={draft.industryOther}
              onChange={(event) => update({ ...draft, industryOther: event.target.value })}
              aria-invalid={errorFor('industry') ? true : undefined}
              aria-describedby={describedBy(
                `${otherId}-hint`,
                errorFor('industry') && `${fieldDomId('industry')}-error`,
              )}
              className={`${inputClass} mt-2 min-h-11 ${inputBorder(errorFor('industry'))}`}
            />
            <FieldError field="industry" message={errorFor('industry')} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
