'use client';

import { useTranslations } from 'next-intl';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { Link } from '@/i18n/navigation';
import { analytics } from '@/lib/analytics';
import { ariaCurrentFor } from '@/lib/nav';
import { paths } from '@/lib/routes';
import { ConfiguratorLinkText, useRequestSummary } from '@/components/request/RequestCount';
import { hudLink, primaryButton } from '@/components/ui/styles';
import { sceneNodeId } from '@/scene/node-ids';
import { BootIndicator } from './BootIndicator';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileMenu } from './MobileMenu';
import { NodeMark } from './NodeMark';
import { ServicesMenu } from './ServicesMenu';
import { SimpleModeToggle } from './SimpleModeToggle';
import type { NavCategory } from '@/lib/nav';
import { useHudLocation } from './use-hud-section';

interface HudProps {
  /** Category navigation built on the server from `content/`. */
  categories: readonly NavCategory[];
  studioName: string;
  /**
   * Accessible name of the wordmark link, formatted on the server: it is the
   * only interface string with an argument, and formatting it here would
   * initialise ICU (intl-messageformat) during hydration (perf P-08).
   */
  homeLabel: string;
}

/**
 * Persistent top bar: wordmark, primary navigation, locale switcher and CTA.
 * The full-width header box is a scene overlay (the camera frames below it).
 * The glass bar spans the viewport with 0.75rem gutters at every width, like
 * the home hero and index below it (40 px gutters), so the two grids line up
 * on wide screens too (visual V2-09). A centred max-width bar would instead
 * pull the hero and index inwards and shrink the free column the universe
 * is framed in between them.
 */
export function Hud({ categories, studioName, homeLabel }: HudProps) {
  const t = useTranslations('hud');
  const { pathname } = useHudLocation();
  // Request draft size (M3): a badge on the configurator link while non-empty.
  const request = useRequestSummary();

  return (
    <header
      data-scene-overlay=""
      className="pointer-events-none fixed inset-x-0 top-0 z-30 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] shorter:pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto relative flex h-14 items-center gap-2 rounded-2xl glass pr-1.5 pl-2 md:pr-2 shorter:h-12">
        <Link
          href={paths.home()}
          aria-label={homeLabel}
          aria-current={pathname === paths.home() ? 'page' : undefined}
          className="group flex h-11 items-center gap-2.5 rounded-xl px-2 text-ink transition-colors duration-150 hover:bg-white/[0.04] active:bg-white/[0.08]"
        >
          <NodeMark className="size-6 transition-transform duration-200 ease-calm group-hover:rotate-12" />
          <span className="font-display text-body-s font-medium tracking-[0.22em]">
            {studioName}
          </span>
        </Link>

        <nav
          aria-label={t('primaryNav')}
          className="ml-2 hidden items-center gap-0.5 md:flex lg:ml-6"
        >
          <ServicesMenu categories={categories} />
          {/* Hover/focus lights up the matching node in the scene. */}
          <HighlightLink
            href={paths.portfolio()}
            highlightId={sceneNodeId.portfolio}
            aria-current={ariaCurrentFor(pathname, paths.portfolio())}
            className={hudLink}
          >
            {t('portfolio')}
          </HighlightLink>
          <HighlightLink
            href={paths.configurator()}
            highlightId={sceneNodeId.configurator}
            aria-current={ariaCurrentFor(pathname, paths.configurator())}
            className={hudLink}
          >
            <ConfiguratorLinkText
              text={t('configurator')}
              count={request.count}
              countLabel={request.label}
            />
          </HighlightLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SimpleModeToggle className="max-md:hidden" />
          <LocaleSwitcher className="hidden md:block" />
          <LocaleSwitcher variant="menu" className="md:hidden" />
          <Link
            href={paths.configurator()}
            onClick={() => analytics.track('cta_click', { placement: 'hud' })}
            className={`${primaryButton} hud-cta h-10 px-5 text-body-s max-lg:hidden pointer-coarse:h-11`}
          >
            {t('cta')}
          </Link>
          <MobileMenu categories={categories} studioName={studioName} className="md:hidden" />
        </div>
        <BootIndicator />
      </div>
    </header>
  );
}
