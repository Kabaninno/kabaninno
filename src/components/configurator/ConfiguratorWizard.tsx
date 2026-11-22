'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { analytics } from '@/lib/analytics';
import { stepsFor, type ConfiguratorStepId } from '@/lib/configurator-steps';
import {
  canEnterStep,
  chooseGuided,
  chooseManual,
  emptyDraft,
  isStepValid,
  neighbourStep,
  refsFromSearch,
  removeService,
  servicesOf,
  toggleService,
  validateStep,
  type ConfiguratorDraft,
  type StepErrors,
} from '@/lib/configurator/draft';
import { errorText, type WizardLabels } from '@/lib/configurator/labels';
import type { ConfiguratorModel } from '@/lib/configurator/model';
import {
  editMessage,
  emphasisForDraft,
  keepEdit,
  requestSync,
  startingState,
  urlWithoutPrefill,
  type MessageEdit,
} from '@/lib/configurator/session';
import { clearConfigurator, loadConfigurator, saveConfigurator } from '@/lib/configurator/storage';
import { TelegramLinkSubmitter } from '@/lib/configurator/submitters';
import { useRequestStore } from '@/store/request';
import { useSceneStore } from '@/store/scene';
import { ContactFields } from './ContactFields';
import { DetailsStep } from './DetailsStep';
import { focusField } from './fields';
import { GoalsStep } from './GoalsStep';
import { PlanStep } from './PlanStep';
import { ProgressNav } from './ProgressNav';
import { SolutionStep } from './SolutionStep';
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
 * The solution finder (D149), inside the configurator panel (side panel on
 * desktop, bottom sheet on phones): a short diagnostic for visitors who do not
 * know the technology.
 *
 * - Five steps: goals → details → solution → budget and timing → contact and
 *   summary. "I know what I need" (manual mode) skips the details step.
 *   Earlier steps are always reachable, later ones once the previous are valid
 *   (`canEnterStep`).
 * - Errors appear after "Next" (not while typing), with `aria-invalid`,
 *   `aria-describedby`, and focus on the first invalid field.
 * - The draft is saved (debounced) to localStorage and restored on return;
 *   "Start over" clears it after an inline confirmation.
 * - Prefill: services from the request draft (D66) and `?add=` are picked on
 *   entry, with a polite notice; a visitor who answered no goal yet continues in
 *   the manual mode on the solution step (D150). The request draft mirrors the
 *   services the visitor picked themselves from then on.
 * - Scene (D81): the categories of the current services are emphasised while
 *   the configurator is open; cleared on unmount.
 * - Compact chrome (visual MJ-1): the panel header (h1 `configurator-title`)
 *   shows its lead on the first step only, the steps are one scrollable row
 *   of chips, and Back / Next (on the last step: Send / Copy) sit in a sticky
 *   glass footer at the bottom of the panel.
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
  const [step, setStep] = useState<ConfiguratorStepId>('goals');
  const [attempted, setAttempted] = useState<Partial<Record<ConfiguratorStepId, true>>>({});
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // The budget range was cleared because the services moved to another level (D138).
  const [budgetReset, setBudgetReset] = useState(false);
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

  const steps = stepsFor(draft.mode);
  const services = useMemo(() => servicesOf(draft, model), [draft, model]);

  // Restore the stored draft and apply the prefill once the request draft is known.
  useEffect(
    () =>
      whenRequestHydrated(() => {
        const stored = loadConfigurator(model);
        const refs = [
          ...useRequestStore.getState().items,
          ...refsFromSearch(window.location.search),
        ];
        const start = startingState(stored, refs, model);
        const request = useRequestStore.getState();
        for (const ref of requestSync(emptyDraft(), start.draft).add) request.add(ref);
        draftRef.current = start.draft;
        setDraft(start.draft);
        setStep(start.step);
        if (start.message) setMessage(start.message);
        if (start.added.length > 0) setNotice(labels.prefilled);
        // Applied once: drop `?add=` so a reload or Back does not re-add a
        // service dropped since (Q-F3-02). Keeps other params and the hash.
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

  // Scene emphasis of the categories the request is about so far (D81).
  useEffect(() => {
    useSceneStore.getState().setEmphasis(emphasisForDraft(draft, model));
  }, [draft, model]);
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

  const update = useCallback((next: ConfiguratorDraft) => {
    const sync = requestSync(draftRef.current, next);
    const request = useRequestStore.getState();
    for (const ref of sync.add) request.add(ref);
    for (const ref of sync.remove) request.remove(ref);
    // A changed selection can drop the chosen range: say so on the budget step.
    if (draftRef.current.budget !== null && next.budget === null) setBudgetReset(true);
    else if (next.budget !== null) setBudgetReset(false);
    draftRef.current = next;
    setDraft(next);
  }, []);

  const goTo = (target: ConfiguratorStepId, from: ConfiguratorDraft = draft) => {
    const order = stepsFor(from.mode);
    if (!order.includes(target)) return;
    if (order.indexOf(target) > order.indexOf(step) && !canEnterStep(target, from, model)) return;
    moved.current = true;
    setConfirmReset(false);
    setStep(target);
  };

  const handoff = useLeadHandoff({
    draft,
    services,
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

  /** Marks the step as attempted and focuses its first invalid field; true when it is valid. */
  const requireValid = (target: ConfiguratorStepId): boolean => {
    const found = validateStep(target, draft, model);
    const fields = Object.keys(found);
    if (fields.length === 0) return true;
    setAttempted((current) => ({ ...current, [target]: true }));
    // Wait for the error markup, then focus the first invalid field.
    window.requestAnimationFrame(() => focusField(fields[0]!));
    return false;
  };

  const next = () => {
    if (!requireValid(step)) return;
    const target = neighbourStep(draft, step, 1);
    if (target) goTo(target);
  };

  const back = () => {
    const target = neighbourStep(draft, step, -1);
    if (target) goTo(target);
  };

  /** "I know what I need": the manual mode, on the solution step, no questions. */
  const knowWhatINeed = () => {
    const manual = chooseManual(draft, model);
    update(manual);
    goTo('solution', manual);
  };

  /** Back from the manual mode to the questions. */
  const backToGuided = () => {
    const guided = chooseGuided(draft);
    update(guided);
    goTo('goals', guided);
  };

  const startOver = () => {
    clearConfigurator();
    useRequestStore.getState().clear();
    draftRef.current = emptyDraft();
    setDraft(emptyDraft());
    setBudgetReset(false);
    setAttempted({});
    setNotice('');
    setMessage(null);
    setConfirmReset(false);
    moved.current = true;
    setStep('goals');
    headingRef.current?.focus();
  };

  const index = steps.indexOf(step);
  const isLast = index === steps.length - 1;
  const progress = labels.progress[draft.mode === 'manual' ? 'manual' : 'guided'][index] ?? '';

  return (
    <div>
      <p className="eyebrow">{header.eyebrow}</p>
      <h1
        id="configurator-title"
        className="mt-2 font-display text-title leading-tight font-medium text-ink md:text-title-md"
      >
        {header.title}
      </h1>
      {step === 'goals' ? (
        // Phones: the step's own hint says the same, and the first screen belongs to the goals.
        <p className="mt-2 text-body leading-relaxed text-muted max-md:sr-only">{header.lead}</p>
      ) : null}
      {/* Always rendered, so screen readers announce the notice when it appears. */}
      <p role="status" className="text-sm text-muted [&:not(:empty)]:mt-2">
        {notice}
      </p>

      <ProgressNav steps={steps} current={step} names={labels.steps} progress={progress} />

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
          {labels.titles[step]}
        </h2>
        <p className="mt-1.5 mb-5 text-sm leading-relaxed text-muted">{labels.hints[step]}</p>

        {step === 'goals' ? (
          <GoalsStep
            model={model}
            labels={labels}
            draft={draft}
            update={update}
            error={errorFor('goals')}
            onKnowIt={knowWhatINeed}
          />
        ) : null}

        {step === 'details' ? (
          <DetailsStep
            model={model}
            labels={labels}
            draft={draft}
            update={update}
            errorFor={errorFor}
          />
        ) : null}

        {step === 'solution' ? (
          <SolutionStep
            model={model}
            labels={labels}
            services={services}
            manual={draft.mode === 'manual'}
            onRemove={(id) => update(removeService(draft, id, model))}
            onToggle={(id) => update(toggleService(draft, id, model))}
            onBackToGuided={backToGuided}
          />
        ) : null}

        {step === 'plan' ? (
          <PlanStep
            model={model}
            labels={labels}
            draft={draft}
            services={services}
            update={update}
            errorFor={errorFor}
            budgetReset={budgetReset}
          />
        ) : null}

        {step === 'contact' ? (
          <div className="flex flex-col gap-8">
            <ContactFields
              model={model}
              labels={labels}
              draft={draft}
              update={update}
              errorFor={errorFor}
            />
            <SummaryStep
              draft={draft}
              services={services}
              labels={labels}
              handoff={handoff}
              onEdit={goTo}
              onEdited={(text) => setMessage((current) => editMessage(current, text, handoff.full))}
              onRestoreDefault={() => setMessage(null)}
              onKeepEdit={() => setMessage((current) => current && keepEdit(current, handoff.full))}
            />
          </div>
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
            {/* Icon-only on narrow last-step footers, where three buttons share the row. */}
            <span className={isLast ? 'max-sm:sr-only' : undefined}>{labels.nav.back}</span>
          </button>
        ) : null}
        {!isLast ? (
          <button
            type="submit"
            form={FORM_ID}
            className={`${primaryButton} min-h-12 flex-1 px-6 text-sm sm:flex-none`}
          >
            {labels.nav.next}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <SummaryActions
            handoff={handoff}
            labels={labels}
            contactValid={isStepValid('contact', draft, model)}
            onBlocked={() => requireValid('contact')}
          />
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
