'use client';

import type { ReactNode } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { accentStyle } from '@/lib/style';

/** DOM id of a draft field, e.g. "business.industry" → "cfg-business-industry". */
export function fieldDomId(field: string): string {
  return `cfg-${field.replace(/\./g, '-')}`;
}

/**
 * Focuses a field (text input, or the first option of a group) and centres
 * it in the panel, so it is never left under the sticky footer (A-F3-03).
 */
export function focusField(field: string): void {
  const id = fieldDomId(field);
  const element = document.getElementById(id) ?? document.getElementById(`${id}-0`);
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

export function FieldError({ field, message }: { field: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${fieldDomId(field)}-error`} className="mt-2 text-sm text-[#ff9aac]">
      {message}
    </p>
  );
}

export interface Option {
  value: string;
  label: string;
  /** DNA accent shown as a dot (categories). */
  accent?: string;
}

interface OptionGroupProps {
  field: string;
  legend: string;
  hint?: string;
  type: 'checkbox' | 'radio';
  options: readonly Option[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  error?: string;
  columns?: 1 | 2;
  /** A small caption above the legend, part of the group's name (the goal a question belongs to). */
  kicker?: string;
  /** The step's heading already asks the question: keep the legend for screen readers only. */
  hideLegend?: boolean;
  /** Option values that cannot be picked now (an unchecked one while a limit is reached). */
  disabled?: readonly string[];
  /** Extra content under the legend (e.g. a category name in the features step). */
  children?: ReactNode;
}

/**
 * A group of native checkboxes (multi-select) or radios (single choice) in a
 * fieldset with a legend. Each option is a full-width label (≥ 44 px on
 * touch). After a failed "Next", every input of the group carries
 * `aria-invalid` and points at the error with `aria-describedby`.
 */
export function OptionGroup({
  field,
  legend,
  hint,
  type,
  options,
  selected,
  onToggle,
  error,
  columns = 1,
  disabled = [],
  kicker,
  hideLegend = false,
  children,
}: OptionGroupProps) {
  const id = fieldDomId(field);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? 'sr-only' : 'mb-1 text-body font-medium text-ink'}>
        {kicker ? <span className="mb-1 block eyebrow">{kicker}</span> : null}
        {legend}
      </legend>
      {hint ? (
        <p id={hintId} className="mb-3 text-sm leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      <div
        className={`grid gap-1.5 ${columns === 2 ? 'sm:grid-cols-2' : ''} ${hint ? '' : 'mt-2'}`}
      >
        {options.map((option, index) => {
          const checked = selected.includes(option.value);
          const blocked = !checked && disabled.includes(option.value);
          return (
            <label
              key={option.value}
              style={option.accent ? accentStyle(option.accent) : undefined}
              className={`group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors duration-150 ease-calm md:min-h-10 md:pointer-coarse:min-h-11 ${
                blocked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'
              } ${
                checked
                  ? 'border-[color-mix(in_srgb,var(--accent,var(--color-brand))_60%,transparent)] bg-[color-mix(in_srgb,var(--accent,var(--color-brand))_12%,transparent)] text-ink'
                  : 'border-white/[0.08] text-ink/90 hover:border-white/20 hover:bg-white/[0.04]'
              } ${error ? 'border-[#ff9aac]/50' : ''}`}
            >
              <input
                id={`${id}-${index}`}
                type={type}
                name={id}
                value={option.value}
                checked={checked}
                disabled={blocked}
                onChange={() => onToggle(option.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(hintId, errorId)}
                className="choice-box"
              />
              {option.accent ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                />
              ) : null}
              <span className="min-w-0">{option.label}</span>
            </label>
          );
        })}
      </div>
      <FieldError field={field} message={error} />
    </fieldset>
  );
}

/**
 * Optional single choice as toggle chips (the industry): pressing the chosen
 * chip again clears it. Plain buttons with `aria-pressed`, in a group named by
 * the legend.
 */
export function ChipGroup({
  field,
  legend,
  hint,
  options,
  value,
  onChange,
  error,
}: {
  field: string;
  legend: string;
  hint?: string;
  options: readonly Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}) {
  const id = fieldDomId(field);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div role="group" aria-labelledby={`${id}-legend`} aria-describedby={hintId}>
      <p id={`${id}-legend`} className="text-body font-medium text-ink">
        {legend}
      </p>
      {hint ? (
        <p id={hintId} className="mt-1 text-sm leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option, index) => {
          const pressed = value === option.value;
          return (
            <button
              key={option.value}
              id={`${id}-${index}`}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(pressed ? null : option.value)}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors duration-150 ease-calm ${
                pressed
                  ? 'border-[color-mix(in_srgb,var(--color-brand)_60%,transparent)] bg-[color-mix(in_srgb,var(--color-brand)_14%,transparent)] text-ink'
                  : 'border-white/[0.12] text-ink/90 hover:border-white/25 hover:bg-white/[0.04] active:bg-white/[0.08]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <FieldError field={field} message={error} />
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border bg-[rgb(255_255_255/0.03)] px-3.5 py-2.5 text-body text-ink placeholder:text-faint ' +
  'transition-colors duration-150 ease-calm hover:border-white/25 focus-visible:border-[var(--color-brand)] ';

export function inputBorder(error?: string): string {
  return error ? 'border-[#ff9aac]/60' : 'border-white/[0.12]';
}

export { describedBy };

/** A quiet text-link look for in-form actions that are buttons (44 px tall). */
export const linkButtonClass =
  'min-h-11 rounded-full px-2 text-sm text-muted underline decoration-white/25 underline-offset-4 ' +
  'transition-colors duration-150 hover:text-ink active:text-white';
