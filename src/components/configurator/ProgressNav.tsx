'use client';

import { useEffect, useRef } from 'react';
import type { ConfiguratorStepId } from '@/lib/configurator-steps';
import { prefersReducedMotion } from '@/lib/motion';
import { formatIndex } from '@/lib/style';

interface ProgressNavProps {
  /** The steps of the current mode, in order (the manual mode has no details step). */
  steps: readonly ConfiguratorStepId[];
  current: ConfiguratorStepId;
  /** May the visitor jump to this step (earlier ones always; later ones per `canEnterStep`). */
  canEnter: (step: ConfiguratorStepId) => boolean;
  onSelect: (step: ConfiguratorStepId) => void;
  names: Record<ConfiguratorStepId, string>;
  /** "Krok X z N" for the current step. */
  progress: string;
  label: string;
}

/**
 * Progress of the request wizard: "Krok X z N", a thin bar and the list of
 * steps. Reachable steps are buttons; the current one has
 * `aria-current="step"`; steps that cannot be entered yet are disabled.
 *
 * The steps form one horizontally scrollable row of chips (MN-1, MJ-1: no
 * 3+3+1 wrapping that pushed the step content down); the current chip is
 * scrolled into view inside the row (never the panel) on every step change.
 */
export function ProgressNav({
  steps,
  current,
  canEnter,
  onSelect,
  names,
  progress,
  label,
}: ProgressNavProps) {
  const index = steps.indexOf(current);
  const rowRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!row || !chip) return;
    // Centre the chip in the row; horizontal only, so the panel does not jump.
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [current]);

  return (
    <nav aria-label={label} className="mt-4">
      <p className="flex items-center justify-between eyebrow">
        <span>{progress}</span>
        <span aria-hidden="true" className="mono-index text-faint">
          {formatIndex(index + 1)} / {formatIndex(steps.length)}
        </span>
      </p>
      <div aria-hidden="true" className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-300 ease-calm"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>
      <ol
        ref={rowRef}
        className="relative -mx-1 mt-2 flex scroll-thin gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,#000_0.75rem,#000_calc(100%-0.75rem),transparent)] px-1 pt-0.5 pb-1.5"
      >
        {steps.map((step, position) => {
          const isCurrent = step === current;
          const enabled = isCurrent || position < index || canEnter(step);
          return (
            <li key={step} className="shrink-0">
              <button
                type="button"
                disabled={!enabled}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onSelect(step)}
                // Keyboard focus inside the scrolling row stays visible (A-F3-03).
                onFocus={(event) =>
                  event.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' })
                }
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-xs whitespace-nowrap text-muted transition-colors duration-150 hover:border-white/15 hover:text-ink active:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-faint/60 disabled:hover:border-transparent aria-[current=step]:border-white/20 aria-[current=step]:bg-white/[0.06] aria-[current=step]:text-ink pointer-coarse:min-h-11"
              >
                <span aria-hidden="true" className="mono-index">
                  {formatIndex(position + 1)}
                </span>
                {names[step]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
