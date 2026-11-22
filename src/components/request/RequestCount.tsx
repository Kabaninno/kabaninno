'use client';

import { useTranslations } from 'next-intl';
import { requestLinkName } from '@/lib/a11y-names';
import { useRequestCount } from '@/store/request';

/**
 * Size of the request draft (D66) for the configurator links, with its
 * spoken form, e.g. "2 usługi w zapytaniu". `count` is 0 on the server and
 * during hydration.
 */
export function useRequestSummary(): { count: number; label: string } {
  const t = useTranslations('hud');
  const count = useRequestCount();
  return { count, label: count > 0 ? t('requestCount', { count }) : '' };
}

/**
 * Content of a configurator link: its text, plus a count badge while the
 * request is not empty. The link has no `aria-label` (A-F3-02): with a badge,
 * the visible text and digit are `aria-hidden` and the name is one sr-only
 * string, "Konfigurator, 2 usługi w zapytaniu", so it starts with the visible
 * label and has no stray space before the comma (see `a11y-names.ts`).
 */
export function ConfiguratorLinkText({
  text,
  count,
  countLabel,
}: {
  text: string;
  count: number;
  countLabel: string;
}) {
  if (count <= 0) return <>{text}</>;
  return (
    <>
      <span aria-hidden="true">{text}</span>
      <span
        aria-hidden="true"
        className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-micro leading-none font-medium text-void tabular-nums"
      >
        {count}
      </span>
      <span className="sr-only">{requestLinkName(text, countLabel)}</span>
    </>
  );
}
