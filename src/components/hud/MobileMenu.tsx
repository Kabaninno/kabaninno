'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { Link } from '@/i18n/navigation';
import { analytics } from '@/lib/analytics';
import { ariaCurrentFor } from '@/lib/nav';
import { paths } from '@/lib/routes';
import { accentStyle, formatIndex } from '@/lib/style';
import { ConfiguratorLinkText, useRequestSummary } from '@/components/request/RequestCount';
import { primaryButton } from '@/components/ui/styles';
import { sceneNodeId } from '@/scene/node-ids';
import { useSceneStore } from '@/store/scene';
import { LocaleSwitcher } from './LocaleSwitcher';
import { NodeMark } from './NodeMark';
import { SimpleModeToggle } from './SimpleModeToggle';
import type { NavCategory } from '@/lib/nav';
import { useHudLocation } from './use-hud-section';

interface MobileMenuProps {
  categories: readonly NavCategory[];
  studioName: string;
  className?: string;
}

const MD_QUERY = '(min-width: 48rem)';

/**
 * Mobile navigation in a native modal <dialog>: focus moves inside on open,
 * the page behind is inert, Esc closes it and focus returns to the button.
 * Open state is keyed by pathname, so navigating closes it.
 */
export function MobileMenu({ categories, studioName, className }: MobileMenuProps) {
  const t = useTranslations('hud');
  const { pathname } = useHudLocation();
  const request = useRequestSummary();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync the DOM dialog with React state (no state updates here).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // The trigger is hidden from md up; never leave a modal open there.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(MD_QUERY);
    const onChange = () => {
      if (query.matches) setOpenOn(null);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [open]);

  const close = () => setOpenOn(null);

  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    // Backdrop click (outside the sheet) or any link inside it.
    if (event.target === event.currentTarget) close();
    else if ((event.target as Element).closest('a')) close();
  };

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('menuOpen')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpenOn(pathname)}
        className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-white/[0.06] active:bg-white/10"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
          <path
            d="M4 8h16M4 16h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-label={t('primaryNav')}
        onClose={() => {
          setOpenOn(null);
          // A focused link inside the closed dialog must not leave its node
          // highlighted (and its scene label on screen).
          useSceneStore.getState().setHighlighted(null);
          buttonRef.current?.focus();
        }}
        onClick={onDialogClick}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-3 text-ink backdrop:bg-void/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
      >
        <div className="flex max-h-full flex-col overflow-hidden rounded-2xl glass-panel transition-[opacity,translate] duration-250 ease-calm starting:-translate-y-2 starting:opacity-0">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] pr-1.5 pl-3">
            <span className="flex items-center gap-2.5" aria-hidden="true">
              <NodeMark className="size-6 text-ink" />
              <span className="font-display text-body-s font-medium tracking-[0.22em]">
                {studioName}
              </span>
            </span>
            <button
              type="button"
              onClick={close}
              aria-label={t('menuClose')}
              className="inline-flex size-11 items-center justify-center rounded-full transition-colors duration-150 hover:bg-white/[0.06] active:bg-white/10"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
                <path
                  d="m6 6 12 12M18 6 6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav
            aria-label={t('primaryNav')}
            className="flex-1 scroll-thin overflow-y-auto px-3 py-4"
          >
            <p className="px-3 pb-2 eyebrow">{t('services')}</p>
            <ul className="flex flex-col">
              {categories.map((category) => {
                const href = paths.category(category.id);
                return (
                  <li key={category.id}>
                    <HighlightLink
                      href={href}
                      highlightId={sceneNodeId.category(category.id)}
                      aria-current={ariaCurrentFor(pathname, href)}
                      style={accentStyle(category.color)}
                      className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-[current]:text-ink"
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"
                      />
                      <span aria-hidden="true" className="mono-index text-faint">
                        {formatIndex(category.index)}
                      </span>
                      {category.name}
                    </HighlightLink>
                  </li>
                );
              })}
            </ul>
            <ul className="mt-4 flex flex-col border-t border-white/[0.06] pt-4">
              {(
                [
                  [paths.portfolio(), t('portfolio'), 0, ''],
                  [paths.configurator(), t('configurator'), request.count, request.label],
                ] as const
              ).map(([href, label, count, countLabel]) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={ariaCurrentFor(pathname, href)}
                    className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-base text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-[current]:text-ink"
                  >
                    <ConfiguratorLinkText text={label} count={count} countLabel={countLabel} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 flex-col gap-3 border-t border-white/[0.06] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <SimpleModeToggle variant="row" />
            <LocaleSwitcher size="large" className="self-center" />
            <Link
              href={paths.configurator()}
              onClick={() => analytics.track('cta_click', { placement: 'mobile-menu' })}
              className={`${primaryButton} min-h-12 w-full px-6 text-sm`}
            >
              {t('cta')}
            </Link>
          </div>
        </div>
      </dialog>
    </div>
  );
}
