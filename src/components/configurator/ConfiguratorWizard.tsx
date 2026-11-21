'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { analytics } from '@/lib/analytics';
import { CONFIGURATOR_STEPS, type ConfiguratorStepId } from '@/lib/configurator-steps';
import {
  canEnterStep,
  emptyDraft,
  refsFromSearch,
  toggleFeature,
  toggleType,
  validateStep,
  type ConfiguratorDraft,
  type StepErrors,
} from '@/lib/configurator/draft';
import { errorText, type WizardLabels } from '@/lib/configurator/labels';
import { budgetIds, featuresFor, type ConfiguratorModel } from '@/lib/configurator/model';
import {
  editMessage,
  emphasisForDraft,
  keepEdit,
  requestSync,
  startingDraft,
  urlWithoutPrefill,
  type MessageEdit,
} from '@/lib/configurator/session';
import { clearConfigurator, loadConfigurator, saveConfigurator } from '@/lib/configurator/storage';
import { TelegramLinkSubmitter } from '@/lib/configurator/submitters';
import { useRequestStore } from '@/store/request';
import { useSceneStore } from '@/store/scene';
import {
  FieldError,
  OptionGroup,
  YesNoGroup,
  describedBy,
  fieldDomId,
  focusField,
  inputBorder,
  inputClass,
} from './fields';
import { ProgressNav } from './ProgressNav';
import { SummaryActions, SummaryStep, useLeadHandoff } from './SummaryStep';

interface ConfiguratorWizardProps {
  model: ConfiguratorModel;
  labels: WizardLabels;
  locale: string;
  /** `siteConfig.telegramUsername` (the placeholder means "not configured"). */
  telegramUsername: string;
  /** Panel header, formatted on the server; the lead is shown on the first step only (MJ-1). */
  header: { eyebrow: string; title: string; lead: string };
}

/** The step form; the sticky footer's "Next" submits it from outside (`form` attribute). */
const FORM_ID = 'cfg-form';

/** Debounce of draft persistence while answering. */
const SAVE_DELAY_MS = 300;

/** Waits until the request draft (D66) has been read from storage. */
function whenRequestHydrated(callback: () => void): () => void {
  if (useRequestStore.getState().hydrated) {
    callback();
    return () => {};
  }
  const unsubscribe = useRequestStore.subscribe((state) => {
    if (!state.hydrated) return;
    unsubscribe();
    callback();
  });
  return unsubscribe;
}

/**
 * The request wizard (BRIEF «Конфігуратор запиту»), inside the configurator
 * panel (side panel on desktop, bottom sheet on phones).
 *
 * - Seven steps with a progress indicator; earlier steps are always
 *   reachable, later ones once the previous are valid (`canEnterStep`).
 * - Errors appear after "Next" (not while typing), with `aria-invalid`,
 *   `aria-describedby`, and focus on the first invalid field.
 * - The draft is saved (debounced) to localStorage and restored on return;
 *   "Start over" clears it after an inline confirmation.
 * - Prefill: services from the request draft (D66) and `?add=` are selected
 *   on entry, with a polite notice. The request draft mirrors the wizard's
 *   service choices from then on (deselecting removes it there too).
 * - Scene (D81): the selected solution types are emphasised while the
 *   configurator is open; cleared on unmount.
 * - Compact chrome (visual MJ-1): the panel header (h1 `configurator-title`)
 *   shows its lead on the first step only, the steps are one scrollable row
 *   of chips, and Back / Next (on the summary: Send / Copy) sit in a sticky
 *   glass footer at the bottom of the panel, so the step content and the
 *   actions share the first screen.
 * - All texts arrive pre-formatted in `labels` (server).
 */
export function ConfiguratorWizard({
  model,
  labels,
  locale,
  telegramUsername,
  header,
}: ConfiguratorWizardProps) {
  const [draft, setDraft] = useState<ConfiguratorDraft>(emptyDraft);
  const [step, setStep] = useState<ConfiguratorStepId>('type');
  const [attempted, setAttempted] = useState<Partial<Record<ConfiguratorStepId, true>>>({});
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // The visitor's edit of the summary message and the default it was based on (Q-F3-01).
  const [message, setMessage] = useState<MessageEdit | null>(null);
  const draftRef = useRef(draft);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelResetRef = useRef<HTMLButtonElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const submitter = useMemo(
    () => new TelegramLinkSubmitter({ username: telegramUsername }),
    [telegramUsername],
  );

  // Restore the stored draft and apply the prefill once the request draft is known.
  useEffect(
    () =>
      whenRequestHydrated(() => {
        const stored = loadConfigurator(model);
        const refs = [
          ...useRequestStore.getState().items,
          ...refsFromSearch(window.location.search),
        ];
        const { draft: start, added } = startingDraft(stored?.draft ?? emptyDraft(), refs, model);
        const request = useRequestStore.getState();
        for (const ref of requestSync(emptyDraft(), start, model).add) request.add(ref);
        draftRef.current = start;
        setDraft(start);
        if (stored) setStep(stored.step);
        if (stored?.message) setMessage(stored.message);
        if (added.length > 0) setNotice(labels.prefilled);
        // Applied once: drop `?add=` so a reload or Back does not re-add a
        // service deselected since (Q-F3-02). Keeps other params and the hash.
        const cleaned = urlWithoutPrefill(window.location.href);
        if (cleaned) window.history.replaceState(window.history.state, '', cleaned);
        setReady(true);
      }),
    [model, labels.prefilled],
  );

  // Persist (debounced), and flush the latest state on unmount. The edited
  // message is stored with the draft (Q-F3-05).
  const latest = useRef<{
    draft: ConfiguratorDraft;
    step: ConfiguratorStepId;
    message: MessageEdit | null;
  } | null>(null);
  useEffect(() => {
    if (!ready) return;
    latest.current = { draft, step, message };
    const timer = window.setTimeout(() => saveConfigurator(draft, step, message), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, step, message, ready]);
  useEffect(
    () => () => {
      const last = latest.current;
      if (last) saveConfigurator(last.draft, last.step, last.message);
    },
    [],
  );

  // Scene emphasis of the selected solution types (D81).
  useEffect(() => {
    useSceneStore.getState().setEmphasis(emphasisForDraft(draft));
  }, [draft]);
  useEffect(() => () => useSceneStore.getState().setEmphasis([]), []);

  // The sticky footer's height becomes the panel's bottom scroll padding, so
  // focus scrolling never leaves a field under it (WCAG 2.4.11, A-F3-03).
  useEffect(() => {
    const footer = footerRef.current;
    const scroller = footer?.closest<HTMLElement>('[data-panel-scroll]');
    if (!footer || !scroller) return;
    const publish = () =>
      scroller.style.setProperty('--panel-footer', `${Math.ceil(footer.offsetHeight)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(footer);
    return () => {
      observer.disconnect();
      scroller.style.removeProperty('--panel-footer');
    };
  }, []);

  // The reset confirmation takes focus on its safe choice ("Cancel").
  useEffect(() => {
    if (confirmReset) cancelResetRef.current?.focus();
  }, [confirmReset]);

  // Focus the step heading after a step change (not on the first render).
  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus();
    analytics.track('configurator_step', { step });
  }, [step]);

  const update = useCallback(
    (next: ConfiguratorDraft) => {
      const sync = requestSync(draftRef.current, next, model);
      const request = useRequestStore.getState();
      for (const ref of sync.add) request.add(ref);
      for (const ref of sync.remove) request.remove(ref);
      draftRef.current = next;
      setDraft(next);
    },
    [model],
  );

  const goTo = (target: ConfiguratorStepId) => {
    const index = CONFIGURATOR_STEPS.indexOf(target);
    if (index > CONFIGURATOR_STEPS.indexOf(step) && !canEnterStep(target, draft, model)) return;
    moved.current = true;
    setConfirmReset(false);
    setStep(target);
  };

  const handoff = useLeadHandoff({
    draft,
    labels,
    submitter,
    locale,
    username: submitter.username,
    edit: message,
  });

  const errors: StepErrors = attempted[step] ? validateStep(step, draft, model) : {};
  const errorFor = (field: string) => {
    const code = errors[field];
    return code ? errorText(field, code, labels.errors) : undefined;
  };

  const next = () => {
    const found = validateStep(step, draft, model);
    const fields = Object.keys(found);
    if (fields.length > 0) {
      setAttempted((current) => ({ ...current, [step]: true }));
      // Wait for the error markup, then focus the first invalid field.
      window.requestAnimationFrame(() => focusField(fields[0]!));
      return;
    }
    const target = CONFIGURATOR_STEPS[CONFIGURATOR_STEPS.indexOf(step) + 1];
    if (target) goTo(target);
  };

  const back = () => {
    const target = CONFIGURATOR_STEPS[CONFIGURATOR_STEPS.indexOf(step) - 1];
    if (target) goTo(target);
  };

  const startOver = () => {
    clearConfigurator();
    useRequestStore.getState().clear();
    draftRef.current = emptyDraft();
    setDraft(emptyDraft());
    setAttempted({});
    setNotice('');
    setMessage(null);
    setConfirmReset(false);
    moved.current = true;
    setStep('type');
    headingRef.current?.focus();
  };

  const index = CONFIGURATOR_STEPS.indexOf(step);
  const isLast = step === 'summary';
  const option = (value: string, label: string) => ({ value, label });

  return (
    <div>
      <p className="eyebrow">{header.eyebrow}</p>
      <h1
        id="configurator-title"
        className="mt-2 font-display text-[1.625rem] leading-tight font-medium text-ink md:text-[1.75rem]"
      >
        {header.title}
      </h1>
      {step === 'type' ? (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{header.lead}</p>
      ) : null}
      {/* Always rendered, so screen readers announce the notice when it appears. */}
      <p role="status" className="text-sm text-muted [&:not(:empty)]:mt-2">
        {notice}
      </p>

      <ProgressNav
        current={step}
        canEnter={(target) => canEnterStep(target, draft, model)}
        onSelect={goTo}
        names={labels.steps}
        progress={labels.progress[index] ?? ''}
        label={labels.stepsNav}
      />

      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isLast) next();
        }}
        className="mt-5"
        aria-labelledby="cfg-step-title"
      >
        <h2
          id="cfg-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-xl leading-snug font-medium text-ink"
        >
          {labels.steps[step]}
        </h2>
        <p className="mt-1.5 mb-5 text-sm leading-relaxed text-muted">{labels.hints[step]}</p>

        {step === 'type' ? (
          <OptionGroup
            field="types"
            legend={labels.fields.types}
            type="checkbox"
            options={model.types.map((id) => ({
              value: id,
              label: labels.categories[id]?.name ?? id,
              accent: labels.categories[id]?.color,
            }))}
            selected={draft.types}
            onToggle={(id) => update(toggleType(draft, id, model))}
            error={errorFor('types')}
          />
        ) : null}

        {step === 'features' ? (
          <div className="flex flex-col gap-5">
            {draft.types.map((type) => (
              <OptionGroup
                key={type}
                field={type === draft.types[0] ? 'features' : `features-${type}`}
                legend={labels.categories[type]?.name ?? type}
                type="checkbox"
                options={featuresFor(model, [type]).map((feature) =>
                  option(feature.id, labels.features[feature.id] ?? feature.key),
                )}
                selected={draft.features}
                onToggle={(id) => update(toggleFeature(draft, id, model))}
                error={type === draft.types[0] ? errorFor('features') : undefined}
              />
            ))}
          </div>
        ) : null}

        {step === 'business' ? (
          <div className="flex flex-col gap-6">
            <OptionGroup
              field="business.industry"
              legend={labels.fields.industry}
              type="radio"
              columns={2}
              options={model.industries.map((id) => option(id, labels.industries[id] ?? id))}
              selected={draft.business.industry ? [draft.business.industry] : []}
              onToggle={(id) => update({ ...draft, business: { ...draft.business, industry: id } })}
              error={errorFor('business.industry')}
            />
            <OptionGroup
              field="business.size"
              legend={labels.fields.size}
              type="radio"
              columns={2}
              options={model.companySizes.map((id) => option(id, labels.sizes[id] ?? id))}
              selected={draft.business.size ? [draft.business.size] : []}
              onToggle={(id) => update({ ...draft, business: { ...draft.business, size: id } })}
              error={errorFor('business.size')}
            />
            <YesNoGroup
              field="business.hasWebsite"
              legend={labels.fields.hasWebsite}
              value={draft.business.hasWebsite}
              onChange={(value) =>
                update({ ...draft, business: { ...draft.business, hasWebsite: value } })
              }
              yes={labels.yes}
              no={labels.no}
              error={errorFor('business.hasWebsite')}
            />
            <YesNoGroup
              field="business.hasCrm"
              legend={labels.fields.hasCrm}
              value={draft.business.hasCrm}
              onChange={(value) =>
                update({ ...draft, business: { ...draft.business, hasCrm: value } })
              }
              yes={labels.yes}
              no={labels.no}
              error={errorFor('business.hasCrm')}
            />
          </div>
        ) : null}

        {step === 'budget' ? (
          <OptionGroup
            field="budget"
            legend={labels.fields.budget}
            type="radio"
            options={budgetIds(model).map((id) => option(id, labels.budgets[id] ?? id))}
            selected={draft.budget ? [draft.budget] : []}
            onToggle={(id) => update({ ...draft, budget: id })}
            error={errorFor('budget')}
          />
        ) : null}

        {step === 'timeline' ? (
          <OptionGroup
            field="timeline"
            legend={labels.fields.timeline}
            type="radio"
            options={model.timelines.map((id) => option(id, labels.timelines[id] ?? id))}
            selected={draft.timeline ? [draft.timeline] : []}
            onToggle={(id) => update({ ...draft, timeline: id })}
            error={errorFor('timeline')}
          />
        ) : null}

        {step === 'contact' ? (
          <div className="flex flex-col gap-5">
            <div>
              <label
                htmlFor={fieldDomId('contact.name')}
                className="text-[0.9375rem] font-medium text-ink"
              >
                {labels.fields.name}
              </label>
              <p id={`${fieldDomId('contact.name')}-hint`} className="mt-1 text-sm text-muted">
                {labels.fields.nameHint}
              </p>
              <input
                id={fieldDomId('contact.name')}
                type="text"
                autoComplete="name"
                maxLength={model.limits.nameMax}
                value={draft.contact.name}
                onChange={(event) =>
                  update({ ...draft, contact: { ...draft.contact, name: event.target.value } })
                }
                aria-invalid={errorFor('contact.name') ? true : undefined}
                aria-describedby={describedBy(
                  `${fieldDomId('contact.name')}-hint`,
                  errorFor('contact.name') && `${fieldDomId('contact.name')}-error`,
                )}
                className={`${inputClass} mt-2 min-h-11 ${inputBorder(errorFor('contact.name'))}`}
              />
              <FieldError field="contact.name" message={errorFor('contact.name')} />
            </div>
            <div>
              <label
                htmlFor={fieldDomId('contact.comment')}
                className="text-[0.9375rem] font-medium text-ink"
              >
                {labels.fields.comment}
              </label>
              <p id={`${fieldDomId('contact.comment')}-hint`} className="mt-1 text-sm text-muted">
                {labels.fields.commentHint}
              </p>
              <textarea
                id={fieldDomId('contact.comment')}
                rows={5}
                maxLength={model.limits.commentMax}
                value={draft.contact.comment}
                onChange={(event) =>
                  update({ ...draft, contact: { ...draft.contact, comment: event.target.value } })
                }
                aria-invalid={errorFor('contact.comment') ? true : undefined}
                aria-describedby={describedBy(
                  `${fieldDomId('contact.comment')}-hint`,
                  errorFor('contact.comment') && `${fieldDomId('contact.comment')}-error`,
                )}
                className={`${inputClass} mt-2 resize-y ${inputBorder(errorFor('contact.comment'))}`}
              />
              <p aria-hidden="true" className="mt-1 text-right mono-index text-faint">
                {Array.from(draft.contact.comment).length} / {model.limits.commentMax}
              </p>
              <FieldError field="contact.comment" message={errorFor('contact.comment')} />
            </div>
          </div>
        ) : null}

        {isLast ? (
          <SummaryStep
            draft={draft}
            labels={labels}
            handoff={handoff}
            onEdit={goTo}
            onEdited={(text) => setMessage((current) => editMessage(current, text, handoff.full))}
            onRestoreDefault={() => setMessage(null)}
            onKeepEdit={() => setMessage((current) => current && keepEdit(current, handoff.full))}
          />
        ) : null}
      </form>

      {/*
        Sticky glass footer (MJ-1): stays at the bottom of the panel while the
        step scrolls, full-bleed (cancels the panel paddings), above the
        panel's bottom scroll fade.
      */}
      <div
        ref={footerRef}
        className="sticky bottom-0 z-[2] -mx-[var(--panel-px)] mt-8 flex flex-wrap items-center gap-2 border-t border-white/[0.08] bg-[rgb(8_11_22/0.92)] px-[var(--panel-px)] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
      >
        {index > 0 ? (
          <button
            type="button"
            onClick={back}
            className={`${secondaryButton} min-h-12 min-w-12 shrink-0 px-4 text-sm sm:px-5`}
          >
            <span aria-hidden="true">←</span>
            {/* Icon-only on narrow summary footers, where three buttons share the row. */}
            <span className={isLast ? 'max-sm:sr-only' : undefined}>{labels.nav.back}</span>
          </button>
        ) : null}
        {!isLast ? (
          <button
            type="submit"
            form={FORM_ID}
            className={`${primaryButton} min-h-12 flex-1 px-6 text-sm sm:flex-none`}
          >
            {index === CONFIGURATOR_STEPS.length - 2 ? labels.nav.toSummary : labels.nav.next}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <SummaryActions handoff={handoff} labels={labels} />
        )}
      </div>

      <div className="mt-6 pt-1">
        {confirmReset ? (
          <div
            role="group"
            aria-labelledby="cfg-reset-question"
            className="flex flex-wrap items-center gap-2"
          >
            <p id="cfg-reset-question" className="w-full text-sm text-ink">
              {labels.nav.startOverConfirm}
            </p>
            <button
              type="button"
              onClick={startOver}
              className={`${secondaryButton} min-h-11 px-4 text-sm`}
            >
              {labels.nav.startOverYes}
            </button>
            <button
              ref={cancelResetRef}
              type="button"
              onClick={() => setConfirmReset(false)}
              className={`${secondaryButton} min-h-11 px-4 text-sm`}
            >
              {labels.nav.startOverNo}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="min-h-11 rounded-full px-2 text-sm text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink active:text-white"
          >
            {labels.nav.startOver}
          </button>
        )}
      </div>
    </div>
  );
}
