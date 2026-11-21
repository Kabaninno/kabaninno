'use client';

import { CONFIGURATOR_STEPS, type ConfiguratorStepId } from '@/lib/configurator-steps';
import { formatIndex } from '@/lib/style';

interface ProgressNavProps {
  current: ConfiguratorStepId;
  /** May the visitor jump to this step (earlier ones always; later ones per `canEnterStep`). */
  canEnter: (step: ConfiguratorStepId) => boolean;
  onSelect: (step: ConfiguratorStepId) => void;
  names: Record<ConfiguratorStepId, string>;
  /** "Krok X z 7" for the current step. */
  progress: string;
  label: string;
}

/**
 * Progress of the request wizard: "Krok X z 7", a thin bar and the list of
 * steps. Reachable steps are buttons; the current one has
 * `aria-current="step"`; steps that cannot be entered yet are disabled.
 */
export function ProgressNav({
  current,
  canEnter,
  onSelect,
  names,
  progress,
  label,
}: ProgressNavProps) {
  const index = CONFIGURATOR_STEPS.indexOf(current);
  return (
    <nav aria-label={label} className="mt-6">
      <p className="flex items-center justify-between eyebrow">
        <span>{progress}</span>
        <span aria-hidden="true" className="mono-index text-faint">
          {formatIndex(index + 1)} / {formatIndex(CONFIGURATOR_STEPS.length)}
        </span>
      </p>
      <div aria-hidden="true" className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-300 ease-calm"
          style={{ width: `${((index + 1) / CONFIGURATOR_STEPS.length) * 100}%` }}
        />
      </div>
      <ol className="mt-3 flex flex-wrap gap-1">
        {CONFIGURATOR_STEPS.map((step, position) => {
          const isCurrent = step === current;
          const enabled = isCurrent || position < index || canEnter(step);
          return (
            <li key={step}>
              <button
                type="button"
                disabled={!enabled}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onSelect(step)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-xs text-muted transition-colors duration-150 hover:border-white/15 hover:text-ink active:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-faint/60 disabled:hover:border-transparent aria-[current=step]:border-white/20 aria-[current=step]:bg-white/[0.06] aria-[current=step]:text-ink pointer-coarse:min-h-11"
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
