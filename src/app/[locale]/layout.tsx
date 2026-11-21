import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { siteConfig } from '~/site.config';
import { Hud } from '@/components/hud/Hud';
import { BootState } from '@/components/layout/BootState';
import { EscapeToParent } from '@/components/layout/EscapeToParent';
import { FlightStatus } from '@/components/layout/FlightStatus';
import { IntroControl } from '@/components/layout/IntroControl';
import { RouteFocus } from '@/components/layout/RouteFocus';
import { SafeAreaPublisher } from '@/components/layout/SafeAreaPublisher';
import { SimpleBackdrop } from '@/components/layout/SimpleBackdrop';
import { SkipLink } from '@/components/layout/SkipLink';
import { RouteExit } from '@/components/motion/RouteExit';
import { RequestSync } from '@/components/request/RequestSync';
import { getMessagesFor, pickMessages } from '@/i18n/messages';
import { isLocale, locales } from '@/i18n/routing';
import { allServiceRefs, buildNavCategories } from '@/lib/nav-data';
import { buildSceneManifest } from '@/lib/scene-manifest';
import { simpleModeBootScript } from '@/lib/simple-mode';
import { SITE_URL } from '@/lib/site-url';
import { SceneRoot } from '@/scene/SceneRoot';
import { fontVariables } from '../fonts';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  const studio = siteConfig.studioName;
  return {
    metadataBase: new URL(`${SITE_URL}/`),
    title: { default: t('homeTitle', { studio }), template: `%s · ${studio}` },
    description: t('homeDescription'),
    applicationName: studio,
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#05070D',
  colorScheme: 'dark',
  viewportFit: 'cover',
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('common');
  const tHud = await getTranslations('hud');
  // Client components only get the namespaces they use (D05): the HUD, the
  // localized error boundary (`error.tsx`) and the panel's sheet handle.
  const clientMessages = pickMessages(getMessagesFor(locale), ['hud', 'error', 'panel']);

  // `suppressHydrationWarning`: the inline boot script may add
  // `data-simple` to <html> before React hydrates (simple mode, D94).
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Decides simple (2D) mode before the first paint: no flash of the 3D layout. */}
        <script dangerouslySetInnerHTML={{ __html: simpleModeBootScript() }} />
      </head>
      <body>
        <SkipLink label={t('skipToContent')} />
        <div className="backdrop-cosmos" aria-hidden="true" />
        <SimpleBackdrop />
        <NextIntlClientProvider messages={clientMessages}>
          <BootState />
          <SceneRoot manifest={buildSceneManifest(locale)} />
          <SafeAreaPublisher />
          <FlightStatus />
          <EscapeToParent />
          <RouteFocus />
          <RouteExit />
          <RequestSync serviceRefs={allServiceRefs()} />
          <IntroControl label={tHud('skipIntro')} />
          <Hud
            categories={buildNavCategories(locale)}
            studioName={siteConfig.studioName}
            homeLabel={tHud('homeLabel', { studio: siteConfig.studioName })}
          />
          <main id="main" tabIndex={-1} className="pointer-events-none relative z-10">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
