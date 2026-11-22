'use client';

import { toggleGoal, type ConfiguratorDraft } from '@/lib/configurator/draft';
import type { WizardLabels } from '@/lib/configurator/labels';
import { GOAL_UNSURE, typicalGoals, type ConfiguratorModel } from '@/lib/configurator/model';
import { OptionGroup, linkButtonClass } from './fields';

interface GoalsStepProps {
  model: ConfiguratorModel;
  labels: WizardLabels;
  draft: ConfiguratorDraft;
  update: (next: ConfiguratorDraft) => void;
  error?: string;
  /** "I know what I need": the manual mode, straight to the services. */
  onKnowIt: () => void;
}

/**
 * Step 2: up to `maxGoals` goals as checkboxes, "Not sure yet" as an exclusive
 * last option, and under the list the way out for visitors who already know
 * what they need (D149). Once the limit is reached the other goals are
 * disabled until one is unchecked ("Not sure" stays available: it replaces all).
 * The goals typical for the visitor's industry carry a small "Often chosen in
 * your industry" mark (round 3, B1); nothing is preselected.
 */
export function GoalsStep({ model, labels, draft, update, error, onKnowIt }: GoalsStepProps) {
  const picked = draft.goals.filter((id) => id !== GOAL_UNSURE);
  const atLimit = picked.length >= model.maxGoals;
  const typical = typicalGoals(model, draft.industry);
  return (
    <div>
      <OptionGroup
        field="goals"
        legend={labels.goals.legend}
        hideLegend
        hint={labels.goals.hint}
        type="checkbox"
        options={[
          ...model.goals.map((goal) => ({
            value: goal.id,
            label: labels.goals.names[goal.id] ?? goal.id,
            note: typical.includes(goal.id) ? labels.goals.typical : undefined,
          })),
          { value: GOAL_UNSURE, label: labels.goals.unsure },
        ]}
        selected={draft.goals}
        disabled={atLimit ? model.goals.map((goal) => goal.id) : []}
        onToggle={(id) => update(toggleGoal(draft, id, model))}
        error={error}
      />
      <button type="button" onClick={onKnowIt} className={`${linkButtonClass} mt-3`}>
        {labels.goals.knowIt}
      </button>
    </div>
  );
}
