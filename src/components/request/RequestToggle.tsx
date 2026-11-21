'use client';

import { useState, useSyncExternalStore, type ComponentProps } from 'react';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { Link } from '@/i18n/navigation';
import { analytics } from '@/lib/analytics';
import { paths } from '@/lib/routes';
import { useHasRef, useRequestStore } from '@/store/request';

const subscribeNever = () => () => {};

/** False on the server and during hydration, true afterwards. */
function useInteractive(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export interface RequestToggleLabels {
  /** The button's constant name (WAI-ARIA APG toggle button: the state is `aria-pressed`). */
  add: string;
  /** Live-region text after adding (already formatted with the service name). */
  addedStatus: string;
  /** Live-region text after removing. */
  removedStatus: string;
  goTo: string;
}

interface RequestToggleProps {
  /** `"<category>/<slug>"`. */
  serviceRef: string;
  labels: RequestToggleLabels;
  /** Configurator URL with `?add=` for visitors without JavaScript. */
  fallbackHref: ComponentProps<typeof Link>['href'];
}

const ADDED_STATE =
  'inline-flex items-center justify-center gap-2 rounded-full border border-[var(--accent,var(--color-brand))] ' +
  'bg-[color-mix(in_srgb,var(--accent,var(--color-brand))_18%,transparent)] font-medium text-ink ' +
  'transition-[background-color,border-color] duration-200 ease-calm ' +
  'hover:bg-[color-mix(in_srgb,var(--accent,var(--color-brand))_28%,transparent)] ' +
  'active:bg-[color-mix(in_srgb,var(--accent,var(--color-brand))_36%,transparent)]';

/**
 * «Add to request» on a planet panel (BRIEF scene 2).
 * - Server HTML and pre-hydration: a link to the configurator with `?add=`
 *   (works without JavaScript; the configurator reads it in M4).
 * - Interactive: a toggle button that adds or removes the service in the
 *   request draft (`store/request.ts`). Per the WAI-ARIA APG toggle-button
 *   pattern its name stays «Add to request» and `aria-pressed` carries the
 *   state; the added state shows as a check mark and an accent style. A
 *   polite live region confirms each change, and a secondary link leads to
 *   the request while the service is in it.
 */
export function RequestToggle({ serviceRef, labels, fallbackHref }: RequestToggleProps) {
  const interactive = useInteractive();
  const added = useHasRef(serviceRef);
  const toggle = useRequestStore((state) => state.toggle);
  const [status, setStatus] = useState('');
  const size = 'min-h-12 px-6 text-sm';

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {interactive ? (
        <button
          type="button"
          aria-pressed={added}
          onClick={() => {
            toggle(serviceRef);
            setStatus(added ? labels.removedStatus : labels.addedStatus);
            analytics.track('request_add_service', { service: serviceRef, added: !added });
          }}
          className={`${added ? ADDED_STATE : primaryButton} ${size} w-full sm:w-auto`}
        >
          <span aria-hidden="true">{added ? '✓' : '+'}</span>
          {labels.add}
        </button>
      ) : (
        <Link href={fallbackHref} className={`${primaryButton} ${size} w-full sm:w-auto`}>
          <span aria-hidden="true">+</span>
          {labels.add}
        </Link>
      )}
      {interactive && added ? (
        <Link href={paths.configurator()} className={`${secondaryButton} ${size} w-full sm:w-auto`}>
          {labels.goTo}
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}
