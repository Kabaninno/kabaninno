import type { ConfiguratorStepId } from '@/lib/configurator-steps';
import { formatIndex } from '@/lib/style';

interface ProgressNavProps {
  /** The steps of the current mode, in order (the manual mode has no details step). */
  steps: readonly ConfiguratorStepId[];
  current: ConfiguratorStepId;
  names: Record<ConfiguratorStepId, string>;
  /** "Krok X z N" for the current step: read out, not shown (round 3, A2). */
  progress: string;
}

/**
 * Progress of the request wizard: the name of the current step, "01 / 05"
 * and a thin bar. The visible "Krok X z N" and the scrolling row of step
 * chips are gone (round 3, A2, D154): the index already says the same, and
 * the visitor goes back with the Back button. Screen readers still hear
 * "Krok X z N" before the step name.
 */
export function ProgressNav({ steps, current, names, progress }: ProgressNavProps) {
  const index = steps.indexOf(current);

  return (
    <div className="mt-4">
      <p className="flex items-center justify-between gap-3 eyebrow">
        <span className="min-w-0 truncate">
          <span className="sr-only">{progress}: </span>
          {names[current]}
        </span>
        <span aria-hidden="true" className="shrink-0 mono-index text-faint">
          {formatIndex(index + 1)} / {formatIndex(steps.length)}
        </span>
      </p>
      <div aria-hidden="true" className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-300 ease-calm"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
