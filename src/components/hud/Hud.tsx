'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { analytics } from '@/lib/analytics';
import { ariaCurrentFor } from '@/lib/nav';
import { paths } from '@/lib/routes';
import { hudLink, primaryButton } from '@/components/ui/styles';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileMenu } from './MobileMenu';
import { NodeMark } from './NodeMark';
import { ServicesMenu } from './ServicesMenu';
import type { NavCategory } from '@/lib/nav';
import { useHudLocation } from './use-hud-section';

interface HudProps {
  /** Category navigation built on the server from `content/`. */
  categories: readonly NavCategory[];
  studioName: string;
}

/**
 * Persistent top bar: wordmark, primary navigation, locale switcher and CTA.
 * The full-width header box is a scene overlay (the camera frames below it).
 */
export function Hud({ categories, studioName }: HudProps) {
  const t = useTranslations('hud');
  const { pathname } = useHudLocation();

  return (
    <header
      data-scene-overlay=""
      className="pointer-events-none fixed inset-x-0 top-0 z-30 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] shorter:pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto mx-auto flex h-14 max-w-[90rem] items-center gap-2 rounded-2xl glass pr-1.5 pl-2 md:pr-2 shorter:h-12">
        <Link
          href={paths.home()}
          aria-label={t('homeLabel', { studio: studioName })}
          aria-current={pathname === paths.home() ? 'page' : undefined}
          className="group flex h-11 items-center gap-2.5 rounded-xl px-2 text-ink transition-colors duration-150 hover:bg-white/[0.04] active:bg-white/[0.08]"
        >
          <NodeMark className="size-6 transition-transform duration-200 ease-calm group-hover:rotate-12" />
          <span className="font-display text-[0.8125rem] font-medium tracking-[0.22em]">
            {studioName}
          </span>
        </Link>

        <nav
          aria-label={t('primaryNav')}
          className="ml-2 hidden items-center gap-0.5 md:flex lg:ml-6"
        >
          <ServicesMenu categories={categories} />
          <Link
            href={paths.portfolio()}
            aria-current={ariaCurrentFor(pathname, paths.portfolio())}
            className={hudLink}
          >
            {t('portfolio')}
          </Link>
          <Link
            href={paths.configurator()}
            aria-current={ariaCurrentFor(pathname, paths.configurator())}
            className={hudLink}
          >
            {t('configurator')}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher className="hidden md:block" />
          <Link
            href={paths.configurator()}
            onClick={() => analytics.track('cta_click', { placement: 'hud' })}
            className={`${primaryButton} h-10 px-5 text-[0.8125rem] max-lg:hidden`}
          >
            {t('cta')}
          </Link>
          <MobileMenu categories={categories} studioName={studioName} className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
