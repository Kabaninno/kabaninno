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
  children,
}: OptionGroupProps) {
  const id = fieldDomId(field);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-[0.9375rem] font-medium text-ink">{legend}</legend>
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
          return (
            <label
              key={option.value}
              style={option.accent ? accentStyle(option.accent) : undefined}
              className={`group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors duration-150 ease-calm md:min-h-10 md:pointer-coarse:min-h-11 ${
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

/** Yes / no as a pair of radios. */
export function YesNoGroup({
  field,
  legend,
  value,
  onChange,
  yes,
  no,
  error,
}: {
  field: string;
  legend: string;
  value: 'yes' | 'no' | null;
  onChange: (value: 'yes' | 'no') => void;
  yes: string;
  no: string;
  error?: string;
}) {
  return (
    <OptionGroup
      field={field}
      legend={legend}
      type="radio"
      columns={2}
      options={[
        { value: 'yes', label: yes },
        { value: 'no', label: no },
      ]}
      selected={value ? [value] : []}
      onToggle={(next) => onChange(next as 'yes' | 'no')}
      error={error}
    />
  );
}

export const inputClass =
  'w-full rounded-xl border bg-[rgb(255_255_255/0.03)] px-3.5 py-2.5 text-[0.9375rem] text-ink placeholder:text-faint ' +
  'transition-colors duration-150 ease-calm hover:border-white/25 focus-visible:border-[var(--color-brand)] ';

export function inputBorder(error?: string): string {
  return error ? 'border-[#ff9aac]/60' : 'border-white/[0.12]';
}

export { describedBy };
