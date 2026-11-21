import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { siteConfig } from '~/site.config';
import { Hud } from '@/components/hud/Hud';
import { EscapeToParent } from '@/components/layout/EscapeToParent';
import { FlightStatus } from '@/components/layout/FlightStatus';
import { RouteFocus } from '@/components/layout/RouteFocus';
import { SafeAreaPublisher } from '@/components/layout/SafeAreaPublisher';
import { SkipLink } from '@/components/layout/SkipLink';
import { RouteExit } from '@/components/motion/RouteExit';
import { getMessagesFor, pickMessages } from '@/i18n/messages';
import { isLocale, locales } from '@/i18n/routing';
import { buildNavCategories } from '@/lib/nav-data';
import { buildSceneManifest } from '@/lib/scene-manifest';
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
  // Client components only get the namespaces they use (D05): the HUD and the
  // localized error boundary (`error.tsx`).
  const clientMessages = pickMessages(getMessagesFor(locale), ['hud', 'error']);

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <SkipLink label={t('skipToContent')} />
        <div className="backdrop-cosmos" aria-hidden="true" />
        <NextIntlClientProvider messages={clientMessages}>
          <SceneRoot manifest={buildSceneManifest(locale)} />
          <SafeAreaPublisher />
          <FlightStatus />
          <EscapeToParent />
          <RouteFocus />
          <RouteExit />
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
