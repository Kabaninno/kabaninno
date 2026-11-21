'use client';

import { useMemo, useState } from 'react';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { analytics } from '@/lib/analytics';
import { copyText } from '@/lib/clipboard';
import type { ConfiguratorStepId } from '@/lib/configurator-steps';
import type { ConfiguratorDraft } from '@/lib/configurator/draft';
import type { WizardLabels } from '@/lib/configurator/labels';
import { buildLeadMessage, fitLeadMessage } from '@/lib/configurator/message';
import { isLinkSubmitter, type LeadSubmitter } from '@/lib/configurator/submitters';
import { fieldDomId, inputClass } from './fields';

interface SummaryStepProps {
  draft: ConfiguratorDraft;
  labels: WizardLabels;
  submitter: LeadSubmitter;
  locale: string;
  /** Telegram username used for the URL budget (any string works). */
  username: string;
  onEdit: (step: ConfiguratorStepId) => void;
  /** The visitor's edited message, or null for the default (kept by the wizard across steps). */
  edited: string | null;
  onEditedChange: (text: string | null) => void;
}

/**
 * Step 7: the answers at a glance (each with "Change"), the message in an
 * editable textarea (the full default message, "Restore default"), and the
 * hand-off:
 * - link submitters (Telegram): "Send in Telegram" is a real
 *   `<a target="_blank">` to t.me with the text, the most reliable way on
 *   desktop and phones (D80); "Open chat" (no text) and "Copy text" are always
 *   there as fallbacks; a notice explains a shortened link; without a
 *   configured username only "Copy" remains, with a notice;
 * - other submitters (a future API): a "Send" button calling `submit`.
 */
export function SummaryStep({
  draft,
  labels,
  submitter,
  locale,
  username,
  onEdit,
  edited,
  onEditedChange: setEdited,
}: SummaryStepProps) {
  // The textarea holds the full message (what "Copy" copies); the link
  // carries the version that fits the URL budget: the compact / trimmed
  // default while unedited, or the edited text cut to the budget.
  const full = useMemo(() => buildLeadMessage(draft, labels.lead), [draft, labels.lead]);
  const fitted = useMemo(
    () => fitLeadMessage(draft, labels.lead, { username }),
    [draft, labels.lead, username],
  );
  const [status, setStatus] = useState('');
  const text = edited ?? full;
  const link = isLinkSubmitter(submitter) ? submitter : null;
  const prepared = link?.prepare(edited ?? fitted.text) ?? null;
  const shortened = Boolean(prepared?.truncated) || (edited === null && fitted.truncated);
  const chatUrl = link?.chatUrl() ?? null;
  const unconfigured = link !== null && !link.configured;
  const messageId = fieldDomId('summary.message');

  const copy = async () => {
    // The full (or edited) text, also when the link had to shorten it.
    const ok = await copyText(text);
    setStatus(ok ? labels.summary.copied : labels.summary.copyFailed);
    analytics.track('lead_copy', { ok });
  };

  const send = async () => {
    try {
      const result = await submitter.submit({ text, draft, locale });
      setStatus(result.status === 'sent' ? labels.summary.sent : labels.summary.sendFailed);
    } catch {
      setStatus(labels.summary.sendFailed);
    }
  };

  const answers: { step: ConfiguratorStepId; label: string; value: string }[] = [
    {
      step: 'type',
      label: labels.steps.type,
      value: draft.types.map((id) => labels.categories[id]?.name ?? id).join(', '),
    },
    {
      step: 'features',
      label: labels.steps.features,
      value: draft.features.map((id) => labels.features[id] ?? id).join(', '),
    },
    {
      step: 'business',
      label: labels.steps.business,
      value: [
        draft.business.industry ? labels.industries[draft.business.industry] : null,
        draft.business.size ? labels.sizes[draft.business.size] : null,
      ]
        .filter(Boolean)
        .join(', '),
    },
    {
      step: 'budget',
      label: labels.steps.budget,
      value: draft.budget ? (labels.budgets[draft.budget] ?? '') : '',
    },
    {
      step: 'timeline',
      label: labels.steps.timeline,
      value: draft.timeline ? (labels.timelines[draft.timeline] ?? '') : '',
    },
    { step: 'contact', label: labels.fields.name, value: draft.contact.name.trim() },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="cfg-summary-choices">
        <h3 id="cfg-summary-choices" className="mb-2 eyebrow">
          {labels.summary.choices}
        </h3>
        <dl className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
          {answers.map((answer) => (
            <div key={answer.step} className="flex items-start gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-muted">{answer.label}</dt>
                <dd className="mt-0.5 text-sm text-ink">{answer.value || '—'}</dd>
              </div>
              <button
                type="button"
                onClick={() => onEdit(answer.step)}
                className="min-h-9 shrink-0 rounded-full px-2.5 text-xs text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink active:text-white pointer-coarse:min-h-11"
              >
                {labels.nav.edit}
                <span className="sr-only">: {answer.label}</span>
              </button>
            </div>
          ))}
        </dl>
      </section>

      <div>
        <label htmlFor={messageId} className="text-[0.9375rem] font-medium text-ink">
          {labels.summary.message}
        </label>
        <p id={`${messageId}-hint`} className="mt-1 text-sm text-muted">
          {labels.summary.messageHint}
        </p>
        <textarea
          id={messageId}
          value={text}
          onChange={(event) => setEdited(event.target.value)}
          aria-describedby={`${messageId}-hint`}
          rows={12}
          className={`${inputClass} mt-3 min-h-60 resize-y border-white/[0.12] font-sans text-sm leading-relaxed`}
        />
        {edited !== null && edited !== full ? (
          <button
            type="button"
            onClick={() => setEdited(null)}
            className="mt-2 min-h-9 rounded-full px-2.5 text-xs text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink pointer-coarse:min-h-11"
          >
            {labels.summary.restoreDefault}
          </button>
        ) : null}
      </div>

      {unconfigured ? (
        <p className="corner-brackets bg-white/[0.025] px-4 py-3 text-sm text-muted">
          {labels.summary.unconfigured}
        </p>
      ) : null}
      {link && !unconfigured && shortened ? (
        <p className="corner-brackets bg-white/[0.025] px-4 py-3 text-sm text-muted">
          {labels.summary.truncated}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {link && prepared ? (
          <a
            href={prepared.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              analytics.track('lead_submit', { via: 'telegram', truncated: prepared.truncated })
            }
            className={`${primaryButton} min-h-12 w-full px-6 text-sm sm:w-auto`}
          >
            {labels.summary.send}
            <span className="sr-only"> ({labels.summary.newTab})</span>
          </a>
        ) : null}
        {!link ? (
          <button
            type="button"
            onClick={send}
            className={`${primaryButton} min-h-12 w-full px-6 text-sm sm:w-auto`}
          >
            {labels.summary.send}
          </button>
        ) : null}
        <button
          type="button"
          onClick={copy}
          className={`${secondaryButton} min-h-12 w-full px-6 text-sm sm:w-auto`}
        >
          {labels.summary.copy}
        </button>
        {chatUrl ? (
          <a
            href={chatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${secondaryButton} min-h-12 w-full px-6 text-sm sm:w-auto`}
          >
            {labels.summary.openChat}
            <span className="sr-only"> ({labels.summary.newTab})</span>
          </a>
        ) : null}
      </div>
      <p role="status" className="min-h-5 text-sm text-muted">
        {status}
      </p>
    </div>
  );
}
