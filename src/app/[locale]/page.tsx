import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { siteConfig } from '~/site.config';
import { CategoryIndex } from '@/components/home/CategoryIndex';
import { Reveal } from '@/components/motion/Reveal';
import { isLocale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { UI_MOTION } from '@/lib/motion';
import { buildNavCategories } from '@/lib/nav-data';
import { paths } from '@/lib/routes';
import { homeJsonLd, serializeJsonLd } from '@/lib/structured-data';
import { bindShortWords } from '@/lib/typography';

/**
 * Fixed frame of the home hero and the category index.
 * - Phones (portrait): hero, then the category cards and the call to action,
 *   docked to the bottom (slogan → cards → CTA, D136).
 * - md+: hero bottom-left, card column (with the CTA under it) bottom-right.
 * - Short viewports (`short:`/`shorter:`, landscape phones and squat windows):
 *   compact type, the hero column on the left and one row of chips under it,
 *   so the scene keeps the area to the right (SafeAreaPublisher measures it).
 *   Below 19rem of height the lead is visually hidden (screen readers still
 *   get it); the chips under the hero name the same services.
 * - Laptop heights (`compact:`, md+ up to 820 px tall): the headline gets a
 *   wider column and a height-based size so it stays on two lines, and the
 *   gaps tighten, so the universe keeps a usable band above (visual V2-02).
 * The frame never reaches under the HUD: it is capped at the viewport height
 * minus `--hud-offset` and scrolls inside only as a last resort (e.g. a very
 * large text zoom). On md+ the top fade padding shrinks on squat windows so
 * the hero still fits the cap. Side paddings respect the landscape notch
 * insets. The HUD bar spans the same full width, so its glass edge stays
 * 1.75rem outside the hero and index at every width (V2-09).
 */
const HERO_FRAME = [
  'pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col gap-3.5',
  'max-h-[calc(100dvh-var(--hud-offset))] scroll-thin overflow-x-hidden overflow-y-auto',
  'bg-gradient-to-t from-void/90 via-void/55 to-transparent',
  'pt-16 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]',
  'md:flex-row md:items-end md:justify-between md:gap-10 md:from-void/70 md:via-void/25',
  'md:pt-[clamp(1.5rem,calc(100dvh-30rem),6rem)] md:pr-[max(2.5rem,env(safe-area-inset-right))] md:pb-10 md:pl-[max(2.5rem,env(safe-area-inset-left))]',
  'short:flex-col short:items-start short:gap-2.5 short:from-void/85 short:via-void/40',
  'short:pt-8 short:pr-[max(1rem,env(safe-area-inset-right))] short:pb-[max(0.75rem,env(safe-area-inset-bottom))] short:pl-[max(1rem,env(safe-area-inset-left))]',
  'md:short:pl-[max(1.5rem,env(safe-area-inset-left))]',
  'shorter:gap-2 shorter:pt-4 shorter:pb-[max(0.625rem,env(safe-area-inset-bottom))]',
].join(' ');

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return buildPageMetadata({
    locale,
    path: paths.home(),
    title: t('homeTitle', { studio: siteConfig.studioName }),
    description: t('homeDescription'),
    absoluteTitle: true,
  });
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tHud = await getTranslations('hud');

  // On client-side navigations back to the universe the hero waits for the
  // camera flight to reach ~60 % (never on the initial load, D29); it fades
  // out when leaving (RouteExit).
  return (
    <>
      {/* Studio and service catalogue for search engines (outside the route UI, so exit ghosts never clone it). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd(locale)) }}
      />
      <Reveal
        gate="universe-flight"
        reducedDelayMs={UI_MOTION.homeRevealDelayReducedMs}
        data-route-ui=""
        // Steps aside while the first-visit intro plays (IntroControl, D94).
        data-intro-hide=""
        className={HERO_FRAME}
      >
        <section
          aria-labelledby="home-title"
          data-scene-overlay=""
          className="relative isolate max-w-xl compact:max-w-[48rem] short:pointer-events-auto short:max-w-[min(26rem,56vw)]"
        >
          {/*
          Offsets stay inside the frame padding, so the scroll frame never
          overflows by itself: on phones the copy spans the frame width, so the
          scrim only reaches 1rem (the side padding) past it; from md up the
          hero sits in a narrower column and the scrim can spread wider.
        */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-4 -bottom-12 -left-4 -z-10 hero-scrim md:-top-20 md:-right-28 md:-bottom-10 md:-left-24 short:-top-8 short:-right-12 short:-left-4 shorter:-top-4"
          />
          <p className="mb-3 eyebrow md:mb-4 compact:mb-3 short:mb-1.5 shorter:mb-1 [@media(max-width:47.99rem)_and_(max-height:53rem)]:sr-only">
            {t('eyebrow')}
          </p>
          <h1
            id="home-title"
            className="font-display text-title leading-[1.15] font-medium tracking-[-0.01em] text-balance text-ink xs:text-title-lg md:text-display lg:text-display-lg compact:text-[clamp(2.5rem,6.9vh,var(--text-display-lg))] short:text-display-sm short:leading-[1.18] shorter:text-display-xs"
          >
            {bindShortWords(t('title'), locale)}
          </h1>
          <p className="mt-3 max-w-md text-body leading-relaxed text-muted md:mt-5 md:text-base compact:mt-3 compact:max-w-[34rem] short:mt-2 short:max-w-sm short:text-body-s short:leading-snug shorter:mt-1.5 shorter:text-xs shorter:leading-[1.4] [@media(max-height:19rem)]:sr-only [@media(max-width:47.99rem)_and_(min-height:30.0625rem)]:sr-only">
            {bindShortWords(t('lead'), locale)}
          </p>
        </section>
        <CategoryIndex
          hint={t('explore')}
          categoriesLabel={t('servicesNav')}
          categories={buildNavCategories(locale)}
          portfolio={{ label: tHud('portfolio'), caption: t('portfolioCaption') }}
          cta={{ label: t('cta'), note: t('ctaNote') }}
        />
      </Reveal>
    </>
  );
}
