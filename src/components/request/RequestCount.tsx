'use client';

import { useTranslations } from 'next-intl';
import { useRequestCount } from '@/store/request';

/**
 * Accessible name for a configurator link while the request draft is not
 * empty, e.g. "Konfigurator, 2 usługi w zapytaniu" (visible text first, so
 * the visible label stays part of the name). `undefined` when empty: the link
 * keeps its plain text name. Empty on the server and during hydration.
 */
export function useConfiguratorName(): { count: number; name: string | undefined } {
  const t = useTranslations('hud');
  const count = useRequestCount();
  return {
    count,
    name: count > 0 ? `${t('configurator')}, ${t('requestCount', { count })}` : undefined,
  };
}

/** Small count badge next to the configurator link (decorative: see useConfiguratorName). */
export function RequestCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[0.625rem] leading-none font-medium text-void tabular-nums"
    >
      {count}
    </span>
  );
}
