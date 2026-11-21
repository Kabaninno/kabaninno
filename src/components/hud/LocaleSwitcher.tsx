'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, type MouseEvent } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { locales } from '@/i18n/routing';
import { analytics } from '@/lib/analytics';

interface LocaleSwitcherProps {
  className?: string;
  /** "compact" for the desktop HUD bar, "large" (≥44px targets) for the mobile menu. */
  size?: 'compact' | 'large';
}

/**
 * PL / EN / UK links to the same page in another locale. The links keep the
 * query string (e.g. the configurator's `?add=`); the hash is added at click
 * time (Next.js has no reactive hash state, and reading `location.hash` while
 * rendering a navigation would see the previous URL).
 *
 * `useSearchParams()` needs a Suspense boundary under static export: the
 * prerendered HTML contains the fallback (same links without the query),
 * which the browser swaps for the query-aware links right after hydration.
 */
export function LocaleSwitcher(props: LocaleSwitcherProps) {
  return (
    <Suspense fallback={<LocaleLinks {...props} suffix="" />}>
      <LocaleLinksWithLocation {...props} />
    </Suspense>
  );
}

function LocaleLinksWithLocation(props: LocaleSwitcherProps) {
  const query = useSearchParams().toString();
  return <LocaleLinks {...props} suffix={query ? `?${query}` : ''} />;
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function LocaleLinks({
  className,
  size = 'compact',
  suffix,
}: LocaleSwitcherProps & { suffix: string }) {
  const t = useTranslations('hud');
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const itemClass =
    size === 'large'
      ? 'min-h-11 min-w-14 px-3 text-xs'
      : 'h-8 min-w-9 px-2 text-[0.6875rem] pointer-coarse:h-11 pointer-coarse:min-w-11';

  return (
    <nav aria-label={t('language')} className={className}>
      <ul className="flex items-center gap-0.5">
        {locales.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <Link
                href={`${pathname}${suffix}`}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                // The visible code stays a word of the name (WCAG 2.5.3 Label in
                // Name; axe ignores parenthesised text, so not "Polski (PL)").
                aria-label={`${t(`languageNames.${locale}`)}, ${locale.toUpperCase()}`}
                aria-current={active ? 'true' : undefined}
                onClick={(event) => {
                  if (!active) analytics.track('locale_switch', { from: current, to: locale });
                  const hash = window.location.hash;
                  if (!hash || !isPlainClick(event)) return;
                  event.preventDefault();
                  router.push(`${pathname}${suffix}${hash}`, { locale });
                }}
                className={`inline-flex items-center justify-center rounded-full font-mono font-medium tracking-[0.12em] text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-[current]:bg-white/[0.08] aria-[current]:text-ink ${itemClass}`}
              >
                {locale.toUpperCase()}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
