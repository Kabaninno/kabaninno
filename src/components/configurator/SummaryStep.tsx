'use client';

import { useMemo, useState } from 'react';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { analytics } from '@/lib/analytics';
import { copyText } from '@/lib/clipboard';
import type { ConfiguratorStepId } from '@/lib/configurator-steps';
import type { ConfiguratorDraft } from '@/lib/configurator/draft';
import type { WizardLabels } from '@/lib/configurator/labels';
import { GOAL_UNSURE } from '@/lib/configurator/model';
import { buildLeadMessage, fitLeadMessage } from '@/lib/configurator/message';
import { editButtonName } from '@/lib/a11y-names';
import { isEditStale, messageText, type MessageEdit } from '@/lib/configurator/session';
import {
  isLinkSubmitter,
  type LeadSubmitter,
  type PreparedTelegramLink,
} from '@/lib/configurator/submitters';
import { fieldDomId, inputClass } from './fields';

interface HandoffInput {
  draft: ConfiguratorDraft;
  /** The services the request is about (`servicesOf`). */
  services: readonly string[];
  labels: WizardLabels;
  submitter: LeadSubmitter;
  locale: string;
  /** Telegram username used for the URL budget (any string works). */
  username: string;
  /** The visitor's edit of the message (with its base), or null for the default. */
  edit: MessageEdit | null;
}

export interface LeadHandoff {
  /** The default message for the current answers. */
  full: string;
  /** What "Copy" copies and the textarea shows: the edited text or `full`. */
  text: string;
  /** The visitor edited the message. */
  edited: boolean;
  /** The answers changed after the edit: the edit no longer matches them (Q-F3-01). */
  stale: boolean;
  /** A link submitter (Telegram) is configured with a valid username and produced a link. */
  prepared: PreparedTelegramLink | null;
  /** The link had to shorten the text. */
  shortened: boolean;
  /** A link submitter without a valid username (only "Copy" works). */
  unconfigured: boolean;
  /** A non-link submitter (future API): "Send" calls `submit`. */
  submits: boolean;
  status: string;
  copy: () => Promise<void>;
  send: () => Promise<void>;
}

/**
 * The hand-off state of the summary step, shared by its body (message,
 * notices, status) and the wizard's sticky footer ("Send via
 * Telegram" / "Copy text", MJ-1). The textarea holds the full message (what
 * "Copy" copies); the link carries the version that fits the URL budget:
 * the compact / trimmed default while unedited, or the edited text cut to
 * the budget.
 */
export function useLeadHandoff({
  draft,
  services,
  labels,
  submitter,
  locale,
  username,
  edit,
}: HandoffInput): LeadHandoff {
  const full = useMemo(
    () => buildLeadMessage(draft, services, labels.lead),
    [draft, services, labels.lead],
  );
  const fitted = useMemo(
    () => fitLeadMessage(draft, services, labels.lead, { username }),
    [draft, services, labels.lead, username],
  );
  const [status, setStatus] = useState('');
  const text = messageText(edit, full);
  const link = isLinkSubmitter(submitter) ? submitter : null;
  const prepared = link?.prepare(edit?.text ?? fitted.text) ?? null;

  return {
    full,
    text,
    edited: edit !== null && edit.text !== full,
    stale: isEditStale(edit, full),
    prepared,
    shortened: Boolean(prepared?.truncated) || (edit === null && fitted.truncated),
    unconfigured: link !== null && !link.configured,
    submits: link === null,
    status,
    copy: async () => {
      // The full (or edited) text, also when the link had to shorten it.
      const ok = await copyText(text);
      setStatus(ok ? labels.summary.copied : labels.summary.copyFailed);
      analytics.track('lead_copy', { ok });
    },
    send: async () => {
      try {
        const result = await submitter.submit({ text, draft, locale });
        setStatus(result.status === 'sent' ? labels.summary.sent : labels.summary.sendFailed);
      } catch {
        setStatus(labels.summary.sendFailed);
      }
    },
  };
}

/**
 * Primary actions of the summary step, rendered in the wizard's sticky
 * footer:
 * - "Send via Telegram": ONE button that copies the full message and opens
 *   `t.me/<username>?text=…`. It stays a real `<a target="_blank">` (the most
 *   reliable way on desktop and phones, D80); the copy starts in its click
 *   handler fire-and-forget, without preventing the navigation, so the new
 *   tab is never blocked. A hint under it says the text is already copied if
 *   Telegram did not prefill it (D135);
 * - "Send" for a non-link submitter (a future API);
 * - "Copy text" only while Telegram is not configured, then as the primary
 *   one; otherwise it sits under the message (`SummaryStep`), together with the
 *   hint, so the sticky footer stays one row tall on phones.
 */
export function SummaryActions({
  handoff,
  labels,
  contactValid,
  onBlocked,
}: {
  handoff: LeadHandoff;
  labels: WizardLabels;
  /** The name is filled in: only then "Send" is the real Telegram link. */
  contactValid: boolean;
  /** "Send" pressed while the name is missing: show the error and focus the field. */
  onBlocked: () => void;
}) {
  const { prepared } = handoff;
  const copyIsPrimary = !prepared && !handoff.submits;
  return (
    <>
      {prepared && !contactValid ? (
        <button
          type="button"
          onClick={onBlocked}
          className={`${primaryButton} min-h-12 flex-1 px-5 text-sm sm:flex-none sm:px-6`}
        >
          {labels.summary.send}
        </button>
      ) : null}
      {prepared && contactValid ? (
        <a
          href={prepared.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby={SEND_HINT_ID}
          onClick={() => {
            // Fire-and-forget: the default navigation (new tab) must go ahead.
            void handoff.copy();
            analytics.track('lead_submit', { via: 'telegram', truncated: prepared.truncated });
          }}
          className={`${primaryButton} min-h-12 flex-1 px-5 text-sm sm:flex-none sm:px-6`}
        >
          {labels.summary.send}
          <span className="sr-only"> ({labels.summary.newTab})</span>
        </a>
      ) : null}
      {handoff.submits ? (
        <button
          type="button"
          onClick={contactValid ? handoff.send : onBlocked}
          className={`${primaryButton} min-h-12 flex-1 px-5 text-sm sm:flex-none sm:px-6`}
        >
          {labels.summary.send}
        </button>
      ) : null}
      {copyIsPrimary ? (
        <button
          type="button"
          onClick={handoff.copy}
          className={`${primaryButton} min-h-12 flex-1 px-5 text-sm sm:flex-none sm:px-6`}
        >
          {labels.summary.copy}
        </button>
      ) : null}
    </>
  );
}

/** The hint under "Send via Telegram" (also its accessible description). */
const SEND_HINT_ID = 'cfg-send-hint';

interface SummaryStepProps {
  draft: ConfiguratorDraft;
  services: readonly string[];
  labels: WizardLabels;
  handoff: LeadHandoff;
  onEdit: (step: ConfiguratorStepId) => void;
  /** The visitor typed in the message. */
  onEdited: (text: string) => void;
  /** Back to the default message (also "Update message" after stale answers). */
  onRestoreDefault: () => void;
  /** Keep the stale edit as it is (the notice goes). */
  onKeepEdit: () => void;
}

/**
 * The last step's summary: the answers at a glance (each with "Change"), the message in an
 * editable textarea (the full default message, "Restore default"), notices
 * (shortened link, Telegram not configured) and the status of the last
 * copy/send (a polite live region: "Copied" after "Send via Telegram" too). The primary actions
 * live in the wizard's sticky footer (`SummaryActions`).
 *
 * When an answer changes after the visitor edited the message, the edit is
 * stale: a notice right above the textarea says so and offers "Update
 * message" (regenerates it from the answers) or "Keep my text" (Q-F3-01), so
 * what is copied or sent never silently contradicts the answers shown.
 */
export function SummaryStep({
  draft,
  services,
  labels,
  handoff,
  onEdit,
  onEdited,
  onRestoreDefault,
  onKeepEdit,
}: SummaryStepProps) {
  const messageId = fieldDomId('summary.message');

  const guided = draft.mode === 'guided';
  const answers: { step: ConfiguratorStepId; label: string; value: string }[] = [];
  if (guided && draft.goals.length > 0) {
    answers.push({
      step: 'goals',
      label: labels.summary.rowGoals,
      value: draft.goals
        .map((id) => (id === GOAL_UNSURE ? labels.goals.unsure : (labels.goals.names[id] ?? id)))
        .join(', '),
    });
  }
  if (guided && draft.have.length > 0) {
    answers.push({
      step: 'details',
      label: labels.summary.rowHave,
      value: draft.have.map((id) => labels.details.have[id] ?? id).join(', '),
    });
  }
  answers.push({
    step: 'solution',
    label: labels.summary.rowServices,
    value:
      services.length > 0
        ? services.map((id) => labels.services[id] ?? id).join(', ')
        : labels.summary.rowConsultation,
  });
  answers.push(
    {
      step: 'plan',
      label: labels.summary.rowBudget,
      value: draft.budget ? (labels.budgets[draft.budget] ?? '') : '',
    },
    {
      step: 'plan',
      label: labels.summary.rowTimeline,
      value: draft.timeline ? (labels.timelines[draft.timeline] ?? '') : '',
    },
  );
  if (draft.industry) {
    const other = draft.industry === 'other' ? draft.industryOther.trim() : '';
    answers.push({
      step: 'plan',
      label: labels.summary.rowIndustry,
      value: other || (labels.industries[draft.industry] ?? ''),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="cfg-summary-choices">
        <h3 id="cfg-summary-choices" className="mb-2 eyebrow">
          {labels.summary.choices}
        </h3>
        {/*
          Valid definition list (axe definition-list / dlitem, A-F3-01): each
          row is `div > dt + dd`; the "Change" button lives inside the dd.
        */}
        <dl className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
          {answers.map((answer) => (
            <div key={answer.label} className="px-3.5 py-2.5">
              <dt className="text-xs text-muted">{answer.label}</dt>
              <dd className="mt-0.5 flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm text-ink">{answer.value || '—'}</span>
                <button
                  type="button"
                  onClick={() => onEdit(answer.step)}
                  className="-mt-2 min-h-9 shrink-0 rounded-full px-2.5 text-xs text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink active:text-white pointer-coarse:min-h-11"
                >
                  {/* One sr-only name, no stray space before the colon (a11y-names.ts). */}
                  <span aria-hidden="true">{labels.nav.edit}</span>
                  <span className="sr-only">{editButtonName(labels.nav.edit, answer.label)}</span>
                </button>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div>
        <label htmlFor={messageId} className="text-body font-medium text-ink">
          {labels.summary.message}
        </label>
        <p id={`${messageId}-hint`} className="mt-1 text-sm text-muted">
          {labels.summary.messageHint}
        </p>
        {handoff.stale ? (
          <div
            id={`${messageId}-stale`}
            className="corner-brackets mt-3 bg-[color-mix(in_srgb,var(--color-brand)_7%,transparent)] px-4 py-3"
          >
            <p className="text-sm text-ink">{labels.summary.staleNotice}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRestoreDefault}
                className={`${secondaryButton} min-h-11 px-4 text-sm`}
              >
                {labels.summary.staleUpdate}
              </button>
              <button
                type="button"
                onClick={onKeepEdit}
                className="min-h-11 rounded-full px-3 text-sm text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink active:text-white"
              >
                {labels.summary.staleKeep}
              </button>
            </div>
          </div>
        ) : null}
        <textarea
          id={messageId}
          value={handoff.text}
          onChange={(event) => onEdited(event.target.value)}
          aria-describedby={
            handoff.stale ? `${messageId}-hint ${messageId}-stale` : `${messageId}-hint`
          }
          rows={12}
          className={`${inputClass} mt-3 min-h-60 resize-y border-white/[0.12] font-sans text-sm leading-relaxed`}
        />
        {handoff.edited && !handoff.stale ? (
          <button
            type="button"
            onClick={onRestoreDefault}
            className="mt-2 min-h-9 rounded-full px-2.5 text-xs text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink pointer-coarse:min-h-11"
          >
            {labels.summary.restoreDefault}
          </button>
        ) : null}
        {handoff.prepared || handoff.submits ? (
          <button
            type="button"
            onClick={handoff.copy}
            className={`${secondaryButton} mt-3 min-h-11 px-5 text-sm`}
          >
            {labels.summary.copy}
          </button>
        ) : null}
        {handoff.prepared ? (
          <p id={SEND_HINT_ID} className="mt-2 text-sm leading-snug text-muted">
            {labels.summary.sendHint}
          </p>
        ) : null}
      </div>

      {handoff.unconfigured ? (
        <p className="corner-brackets bg-white/[0.025] px-4 py-3 text-sm text-muted">
          {labels.summary.unconfigured}
        </p>
      ) : null}
      {handoff.prepared && handoff.shortened ? (
        <p className="corner-brackets bg-white/[0.025] px-4 py-3 text-sm text-muted">
          {labels.summary.truncated}
        </p>
      ) : null}

      <p role="status" className="min-h-5 text-sm text-muted">
        {handoff.status}
      </p>
    </div>
  );
}
