import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { siteConfig } from '~/site.config';
import { CategoryIndex } from '@/components/home/CategoryIndex';
import { Reveal } from '@/components/motion/Reveal';
import { ctaArrow, primaryButton } from '@/components/ui/styles';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/metadata';
import { UI_MOTION } from '@/lib/motion';
import { buildNavCategories } from '@/lib/nav-data';
import { paths } from '@/lib/routes';
import { bindShortWords } from '@/lib/typography';

/**
 * Fixed frame of the home hero and the category index.
 * - Phones (portrait): hero, then the category chips, docked to the bottom.
 * - md+: hero bottom-left, index column bottom-right.
 * - Short viewports (`short:`/`shorter:`, landscape phones and squat windows):
 *   compact type, the hero column on the left and one row of chips under it,
 *   so the scene keeps the area to the right (SafeAreaPublisher measures it).
 *   Below 19rem of height the lead is visually hidden (screen readers still
 *   get it); the chips under the hero name the same services.
 * The frame never reaches under the HUD: it is capped at the viewport height
 * minus `--hud-offset` and scrolls inside only as a last resort (e.g. a very
 * large text zoom). On md+ the top fade padding shrinks on squat windows so
 * the hero still fits the cap. Side paddings respect the landscape notch
 * insets.
 */
const HERO_FRAME = [
  'pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col gap-5',
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

  // On client-side navigations back to the universe the hero waits for the
  // camera flight (never on the initial load, see useEnterAnimation).
  return (
    <Reveal
      delayMs={UI_MOTION.homeRevealDelayMs}
      reducedDelayMs={UI_MOTION.homeRevealDelayReducedMs}
      className={HERO_FRAME}
    >
      <section
        aria-labelledby="home-title"
        data-scene-overlay=""
        className="relative isolate max-w-xl short:pointer-events-auto short:max-w-[min(26rem,56vw)]"
      >
        {/* Offsets stay inside the frame padding: the scroll frame must not overflow by itself. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-28 -bottom-12 -left-24 -z-10 hero-scrim md:-top-20 md:-bottom-10 short:-top-8 short:-right-12 shorter:-top-4"
        />
        <p className="mb-3 eyebrow md:mb-4 short:mb-1.5 shorter:mb-1">{t('eyebrow')}</p>
        <h1
          id="home-title"
          className="font-display text-[1.625rem] leading-[1.15] font-medium tracking-[-0.01em] text-balance text-ink xs:text-[1.875rem] md:text-[2.75rem] lg:text-[3.25rem] short:text-[1.375rem] short:leading-[1.18] shorter:text-[1.1875rem]"
        >
          {bindShortWords(t('title'), locale)}
        </h1>
        <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-muted md:mt-5 md:text-base short:mt-2 short:max-w-sm short:text-[0.8125rem] short:leading-snug shorter:mt-1.5 shorter:text-xs shorter:leading-[1.4] [@media(max-height:19rem)]:sr-only">
          {bindShortWords(t('lead'), locale)}
        </p>
        <Link
          href={paths.configurator()}
          className={`${primaryButton} pointer-events-auto mt-5 min-h-12 px-6 text-sm md:mt-7 short:mt-3 short:min-h-11 short:px-5 shorter:mt-2.5`}
        >
          {t('cta')}
          <span aria-hidden="true" className={ctaArrow}>
            →
          </span>
        </Link>
      </section>
      <CategoryIndex label={t('servicesNav')} categories={buildNavCategories(locale)} />
    </Reveal>
  );
}
