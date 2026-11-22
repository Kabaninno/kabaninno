'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { analytics } from '@/lib/analytics';
import { LOCALE_CODES, rememberLocale } from '@/lib/locale-choice';

interface LocaleSwitcherProps {
  className?: string;
  /** "compact" for the desktop HUD bar, "large" (≥44px targets) for the mobile menu. */
  size?: 'compact' | 'large';
  /**
   * `inline`: the three codes side by side (desktop bar, mobile menu).
   * `menu`: one compact button with the current code ("PL ▾") that opens a
   * small list of the three languages (the phone's top bar, D137).
   */
  variant?: 'inline' | 'menu';
}

/**
 * PL / EN / UA links to the same page in another locale (the visible code of
 * Ukrainian is "UA"; `lang`, `hrefLang` and URLs stay `uk`). The links keep
 * the query string (e.g. the configurator's `?add=`); the hash is added at
 * click time (Next.js has no reactive hash state, and reading `location.hash`
 * while rendering a navigation would see the previous URL). An explicit
 * choice is remembered, and the root page `/` uses it from then on.
 *
 * `useSearchParams()` needs a Suspense boundary under static export: the
 * prerendered HTML contains the fallback (same links without the query),
 * which the browser swaps for the query-aware links right after hydration.
 */
export function LocaleSwitcher(props: LocaleSwitcherProps) {
  return (
    <Suspense fallback={<LocaleSwitcherView {...props} suffix="" />}>
      <LocaleSwitcherWithLocation {...props} />
    </Suspense>
  );
}

function LocaleSwitcherWithLocation(props: LocaleSwitcherProps) {
  const query = useSearchParams().toString();
  return <LocaleSwitcherView {...props} suffix={query ? `?${query}` : ''} />;
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function LocaleSwitcherView({
  variant = 'inline',
  suffix,
  ...props
}: LocaleSwitcherProps & { suffix: string }) {
  return variant === 'menu' ? (
    <LocaleMenu {...props} suffix={suffix} />
  ) : (
    <LocaleLinks {...props} suffix={suffix} />
  );
}

/** One language link; remembers the choice and carries the hash over. */
function LocaleLink({
  locale,
  suffix,
  className,
  onChoose,
  children,
}: {
  locale: Locale;
  suffix: string;
  className: string;
  onChoose?: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('hud');
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const active = locale === current;
  return (
    <Link
      href={`${pathname}${suffix}`}
      locale={locale}
      hrefLang={locale}
      lang={locale}
      // The visible code stays a word of the name (WCAG 2.5.3 Label in Name;
      // axe ignores parenthesised text, so not "Polski (PL)").
      aria-label={`${t(`languageNames.${locale}`)}, ${LOCALE_CODES[locale]}`}
      aria-current={active ? 'true' : undefined}
      onClick={(event) => {
        if (!active) analytics.track('locale_switch', { from: current, to: locale });
        rememberLocale(locale);
        onChoose?.();
        const hash = window.location.hash;
        if (!hash || !isPlainClick(event)) return;
        event.preventDefault();
        router.push(`${pathname}${suffix}${hash}`, { locale });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}

function LocaleLinks({
  className,
  size = 'compact',
  suffix,
}: Omit<LocaleSwitcherProps, 'variant'> & { suffix: string }) {
  const t = useTranslations('hud');

  const itemClass =
    size === 'large'
      ? 'min-h-11 min-w-14 px-3 text-xs'
      : 'h-8 min-w-9 px-2 text-label pointer-coarse:h-11 pointer-coarse:min-w-11';

  return (
    <nav aria-label={t('language')} className={className}>
      <ul className="flex items-center gap-0.5">
        {locales.map((locale) => (
          <li key={locale}>
            <LocaleLink
              locale={locale}
              suffix={suffix}
              className={`inline-flex items-center justify-center rounded-full font-mono font-medium tracking-[0.12em] text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-[current]:bg-white/[0.08] aria-[current]:text-ink ${itemClass}`}
            >
              {LOCALE_CODES[locale]}
            </LocaleLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Phone top-bar language control: a disclosure button ("PL ▾") and a small
 * list of the three languages. Esc and a tap outside close it (focus returns
 * to the button on Esc); picking a language navigates and closes it.
 */
function LocaleMenu({
  className,
  suffix,
}: Omit<LocaleSwitcherProps, 'variant'> & { suffix: string }) {
  const t = useTranslations('hud');
  const current = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`relative ${className ?? ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Tabbing out of the control closes it.
        if (open && !rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t('language')}, ${LOCALE_CODES[current]}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-1 rounded-full px-2.5 font-mono text-xs font-medium tracking-[0.12em] text-ink transition-colors duration-150 hover:bg-white/[0.06] active:bg-white/10 aria-expanded:bg-white/[0.08]"
      >
        {LOCALE_CODES[current]}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`size-3.5 transition-transform duration-200 ease-calm ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="m6 9 6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul
        id={listId}
        className={`absolute top-full right-0 z-40 mt-2 min-w-44 flex-col rounded-xl border border-white/10 bg-[rgb(8_11_22/0.97)] p-1 shadow-[0_12px_32px_rgb(0_0_0/0.45)] ${open ? 'flex' : 'hidden'}`}
      >
        {locales.map((locale) => (
          <li key={locale}>
            <LocaleLink
              locale={locale}
              suffix={suffix}
              onChoose={() => setOpen(false)}
              className="flex min-h-11 items-center justify-between gap-4 rounded-lg px-3 text-sm text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-[current]:text-ink"
            >
              <span aria-hidden="true">{t(`languageNames.${locale}`)}</span>
              <span
                aria-hidden="true"
                className="font-mono text-label tracking-[0.12em] text-faint"
              >
                {LOCALE_CODES[locale]}
              </span>
            </LocaleLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
