'use client';

import type { ConfiguratorDraft } from '@/lib/configurator/draft';
import type { WizardLabels } from '@/lib/configurator/labels';
import type { ConfiguratorModel } from '@/lib/configurator/model';
import { FieldError, describedBy, fieldDomId, inputBorder, inputClass } from './fields';

interface ContactFieldsProps {
  model: ConfiguratorModel;
  labels: WizardLabels;
  draft: ConfiguratorDraft;
  update: (next: ConfiguratorDraft) => void;
  errorFor: (field: string) => string | undefined;
}

/** The visitor's name (required) and an optional comment, above the summary of the last step. */
export function ContactFields({ model, labels, draft, update, errorFor }: ContactFieldsProps) {
  const nameId = fieldDomId('contact.name');
  const commentId = fieldDomId('contact.comment');
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor={nameId} className="text-body font-medium text-ink">
          {labels.fields.name}
        </label>
        <p id={`${nameId}-hint`} className="mt-1 text-sm text-muted">
          {labels.fields.nameHint}
        </p>
        <input
          id={nameId}
          type="text"
          autoComplete="name"
          maxLength={model.limits.nameMax}
          value={draft.contact.name}
          onChange={(event) =>
            update({ ...draft, contact: { ...draft.contact, name: event.target.value } })
          }
          aria-invalid={errorFor('contact.name') ? true : undefined}
          aria-describedby={describedBy(
            `${nameId}-hint`,
            errorFor('contact.name') && `${nameId}-error`,
          )}
          className={`${inputClass} mt-2 min-h-11 ${inputBorder(errorFor('contact.name'))}`}
        />
        <FieldError field="contact.name" message={errorFor('contact.name')} />
      </div>
      <div>
        <label htmlFor={commentId} className="text-body font-medium text-ink">
          {labels.fields.comment}
        </label>
        <p id={`${commentId}-hint`} className="mt-1 text-sm text-muted">
          {labels.fields.commentHint}
        </p>
        <textarea
          id={commentId}
          rows={4}
          maxLength={model.limits.commentMax}
          value={draft.contact.comment}
          onChange={(event) =>
            update({ ...draft, contact: { ...draft.contact, comment: event.target.value } })
          }
          aria-invalid={errorFor('contact.comment') ? true : undefined}
          aria-describedby={describedBy(
            `${commentId}-hint`,
            errorFor('contact.comment') && `${commentId}-error`,
          )}
          className={`${inputClass} mt-2 resize-y ${inputBorder(errorFor('contact.comment'))}`}
        />
        <p aria-hidden="true" className="mt-1 text-right mono-index text-faint">
          {Array.from(draft.contact.comment).length} / {model.limits.commentMax}
        </p>
        <FieldError field="contact.comment" message={errorFor('contact.comment')} />
      </div>
    </div>
  );
}
