'use client';

import { INDUSTRY_OTHER_MAX, type ConfiguratorDraft } from '@/lib/configurator/draft';
import type { WizardLabels } from '@/lib/configurator/labels';
import type { ConfiguratorModel } from '@/lib/configurator/model';
import { primaryButton } from '@/components/ui/styles';
import { ChipGroup, FieldError, describedBy, fieldDomId, inputBorder, inputClass } from './fields';

/** The free-text industry id (`content/configurator.ts`). */
const OTHER = 'other';

interface IndustryStepProps {
  model: ConfiguratorModel;
  labels: WizardLabels;
  draft: ConfiguratorDraft;
  /** A chip was picked: save it and move on (no "Next" needed). */
  onPick: (next: ConfiguratorDraft) => void;
  update: (next: ConfiguratorDraft) => void;
  /** "Next" beside the free-text field. */
  onNext: () => void;
  error?: string;
}

/**
 * Step 1 (round 3, B1, D155): the industry as chips, one choice. A tap on a
 * chip moves on to the goals at once; "Other" stays here and opens a short
 * text field with its own "Next". The choice is optional: the footer's "Next"
 * skips it, and a visitor from a planet page never sees this step first.
 */
export function IndustryStep({
  model,
  labels,
  draft,
  onPick,
  update,
  onNext,
  error,
}: IndustryStepProps) {
  const otherId = fieldDomId('industryOther');
  return (
    <div>
      <ChipGroup
        field="industry"
        legend={labels.industry.legend}
        hideLegend
        toggle={false}
        options={model.industries.map((id) => ({
          value: id,
          label: labels.industries[id] ?? id,
        }))}
        value={draft.industry}
        onChange={(industry) => {
          if (industry === null) return;
          const next = {
            ...draft,
            industry,
            industryOther: industry === OTHER ? draft.industryOther : '',
          };
          if (industry === OTHER) update(next);
          else onPick(next);
        }}
        error={draft.industry !== OTHER ? error : undefined}
      />
      {draft.industry === OTHER ? (
        <div className="mt-5">
          <label htmlFor={otherId} className="text-sm font-medium text-ink">
            {labels.industry.other}
          </label>
          <p id={`${otherId}-hint`} className="mt-1 text-sm text-muted">
            {labels.industry.otherHint}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id={otherId}
              type="text"
              maxLength={INDUSTRY_OTHER_MAX}
              value={draft.industryOther}
              onChange={(event) => update({ ...draft, industryOther: event.target.value })}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(
                `${otherId}-hint`,
                error && `${fieldDomId('industry')}-error`,
              )}
              className={`${inputClass} min-h-11 min-w-0 flex-1 basis-56 ${inputBorder(error)}`}
            />
            <button
              type="button"
              onClick={onNext}
              className={`${primaryButton} min-h-11 shrink-0 px-5 text-sm`}
            >
              {labels.industry.next}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <FieldError field="industry" message={error} />
        </div>
      ) : null}
    </div>
  );
}
