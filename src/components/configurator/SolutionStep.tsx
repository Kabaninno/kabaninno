'use client';

import { useState } from 'react';
import { fillTemplate, type WizardLabels } from '@/lib/configurator/labels';
import { categoriesOf } from '@/lib/configurator/recommend';
import type { LeadEstimate } from '@/lib/configurator/message';
import type { ConfiguratorModel } from '@/lib/configurator/model';
import { accentStyle } from '@/lib/style';
import { OptionGroup, linkButtonClass } from './fields';

interface SolutionStepProps {
  model: ConfiguratorModel;
  labels: WizardLabels;
  /** The services the request is about now (recommended minus removed plus added). */
  services: readonly string[];
  /** The estimate of those services, formatted; null without services (a consultation). */
  estimate: LeadEstimate | null;
  manual: boolean;
  onRemove: (id: string) => void;
  /** The full list: adds the service, or removes it when it is in the request. */
  onToggle: (id: string) => void;
  onBackToGuided: () => void;
}

/**
 * Step 3: "You'll be well served by: Web + Telegram bots" and the recommended
 * services grouped by category, each with one line in plain words about what
 * it gives and a button to remove it. "Add more" opens the full list of
 * services by category (open from the start in the manual mode while nothing
 * is picked). Without any service (not sure yet, or all removed) a short text
 * promises to choose together on a free consultation.
 *
 * Under the services, the estimate (round 3, B1, D156): indicative price and
 * timeline, recomputed as soon as a service is removed or added, with a note
 * that it is preliminary; without services it says the price and timeline
 * follow a short free consultation.
 */
export function SolutionStep({
  model,
  labels,
  services,
  estimate,
  manual,
  onRemove,
  onToggle,
  onBackToGuided,
}: SolutionStepProps) {
  const [open, setOpen] = useState(manual && services.length === 0);
  const categories = categoriesOf(model, services);
  const combo = categories.map((id) => labels.categories[id]?.name ?? id).join(' + ');
  const listId = 'cfg-all-services';
  return (
    <div>
      {manual ? (
        <p className="mb-4 text-body leading-relaxed text-muted">
          {labels.solution.manualHint}{' '}
          <button type="button" onClick={onBackToGuided} className={linkButtonClass}>
            {labels.solution.backToGuided}
          </button>
        </p>
      ) : null}

      {services.length > 0 ? (
        <>
          <h3 className="font-display text-lg leading-snug font-medium text-ink">
            {fillTemplate(labels.solution.fits, { combo })}
          </h3>
          <div className="mt-4 flex flex-col gap-5">
            {categories.map((categoryId) => {
              const label = labels.categories[categoryId];
              const own = services.filter((id) => id.split('/')[0] === categoryId);
              return (
                <section
                  key={categoryId}
                  aria-labelledby={`cfg-sol-${categoryId}`}
                  style={accentStyle(label?.color ?? '#E8ECF5')}
                >
                  <h4
                    id={`cfg-sol-${categoryId}`}
                    className="flex items-center gap-2 text-sm font-medium text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    />
                    {label?.name ?? categoryId}
                  </h4>
                  <ul className="mt-2 flex flex-col gap-2">
                    {own.map((id) => {
                      const title = labels.services[id] ?? id;
                      return (
                        <li
                          key={id}
                          className="flex items-start gap-3 rounded-xl border border-white/[0.08] px-3.5 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-body leading-snug font-medium text-ink">{title}</p>
                            <p className="mt-1 text-sm leading-relaxed text-muted">
                              {labels.solution.benefits[id]}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemove(id)}
                            aria-label={fillTemplate(labels.solution.removeNamed, {
                              service: title,
                            })}
                            className="-my-1 min-h-11 shrink-0 rounded-full px-3 text-sm text-muted underline decoration-white/25 underline-offset-4 transition-colors duration-150 hover:text-ink active:text-white"
                          >
                            {labels.solution.remove}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <p className="corner-brackets bg-[color-mix(in_srgb,var(--color-brand)_7%,transparent)] px-4 py-3 text-body leading-relaxed text-ink">
          {labels.solution.consultation}
        </p>
      )}

      <EstimateBlock estimate={estimate} labels={labels.solution.estimate} />

      <div className="mt-5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-ink transition-colors duration-150 ease-calm hover:border-white/35 hover:bg-white/[0.06] active:bg-white/10"
        >
          <span aria-hidden="true">{open ? '−' : '+'}</span>
          {open ? labels.solution.hideList : labels.solution.addMore}
        </button>
        {open ? (
          <div id={listId} className="mt-4 flex flex-col gap-5">
            <p className="eyebrow">{labels.solution.listLegend}</p>
            {model.categories.map((categoryId) => (
              <OptionGroup
                key={categoryId}
                field={`services-${categoryId}`}
                legend={labels.categories[categoryId]?.name ?? categoryId}
                type="checkbox"
                options={(model.services[categoryId] ?? []).map((service) => ({
                  value: service.id,
                  label: labels.services[service.id] ?? service.slug,
                  accent: labels.categories[categoryId]?.color,
                }))}
                selected={services}
                onToggle={onToggle}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "Indicative price … / Indicative timeline …" and the note. A polite live
 * region, so a screen reader hears the new numbers after "Remove" or a pick
 * in the full list.
 */
function EstimateBlock({
  estimate,
  labels,
}: {
  estimate: LeadEstimate | null;
  labels: WizardLabels['solution']['estimate'];
}) {
  return (
    <div
      aria-live="polite"
      className="mt-5 rounded-2xl border border-white/[0.1] bg-white/[0.025] px-4 py-3.5"
    >
      {estimate ? (
        <>
          <dl className="flex flex-col gap-2">
            {(
              [
                [labels.price, estimate.price],
                [labels.timeline, estimate.timeline],
              ] as const
            ).map(([term, value]) => (
              <div key={term} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <dt className="text-sm text-muted">{term}</dt>
                <dd className="font-display text-lg font-medium text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2.5 text-sm leading-relaxed text-muted">{labels.note}</p>
        </>
      ) : (
        <p className="text-body leading-relaxed text-ink">{labels.consultation}</p>
      )}
    </div>
  );
}
