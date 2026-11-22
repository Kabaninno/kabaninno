'use client';

import { setAnswer, toggleHave, type ConfiguratorDraft } from '@/lib/configurator/draft';
import type { WizardLabels } from '@/lib/configurator/labels';
import { GOAL_UNSURE, type ConfiguratorModel } from '@/lib/configurator/model';
import { OptionGroup } from './fields';

interface DetailsStepProps {
  model: ConfiguratorModel;
  labels: WizardLabels;
  draft: ConfiguratorDraft;
  update: (next: ConfiguratorDraft) => void;
  errorFor: (field: string) => string | undefined;
}

/**
 * Step 2, all on one screen: one single-choice question per picked goal (its
 * name above the question), then the shared "What do you already have?" with
 * several answers possible, "nothing of these" being exclusive. For "Not sure
 * yet" only the shared question is shown, with a short note.
 */
export function DetailsStep({ model, labels, draft, update, errorFor }: DetailsStepProps) {
  const goals = model.goals.filter((goal) => draft.goals.includes(goal.id));
  return (
    <div className="flex flex-col gap-7">
      {draft.goals.includes(GOAL_UNSURE) ? (
        <p className="text-body leading-relaxed text-muted">{labels.details.unsureNote}</p>
      ) : null}
      {goals.map((goal) => (
        <OptionGroup
          key={goal.id}
          field={`answers.${goal.id}`}
          legend={labels.details.questions[goal.id] ?? goal.id}
          type="radio"
          options={goal.options.map((option) => ({
            value: option.id,
            label: labels.details.options[goal.id]?.[option.id] ?? option.id,
          }))}
          selected={draft.answers[goal.id] ? [draft.answers[goal.id]!] : []}
          onToggle={(id) => update(setAnswer(draft, goal.id, id, model))}
          kicker={labels.goals.names[goal.id] ?? goal.id}
          error={errorFor(`answers.${goal.id}`)}
        />
      ))}
      <OptionGroup
        field="have"
        legend={labels.details.haveLegend}
        hint={labels.details.haveHint}
        type="checkbox"
        options={model.have.map((id) => ({ value: id, label: labels.details.have[id] ?? id }))}
        selected={draft.have}
        onToggle={(id) => update(toggleHave(draft, id, model))}
        error={errorFor('have')}
      />
    </div>
  );
}
