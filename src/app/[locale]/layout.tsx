import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { siteConfig } from '~/site.config';
import { Hud } from '@/components/hud/Hud';
import { SafeAreaPublisher } from '@/components/layout/SafeAreaPublisher';
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
  // Client components only get the namespaces they use (D05): the HUD and the
  // localized error boundary (`error.tsx`).
  const clientMessages = pickMessages(getMessagesFor(locale), ['hud', 'error']);

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full glass px-5 py-3 text-sm text-ink transition-transform duration-200 focus-visible:translate-y-0"
        >
          {t('skipToContent')}
        </a>
        <div className="backdrop-cosmos" aria-hidden="true" />
        <NextIntlClientProvider messages={clientMessages}>
          <SceneRoot manifest={buildSceneManifest(locale)} />
          <SafeAreaPublisher />
          <Hud categories={buildNavCategories(locale)} studioName={siteConfig.studioName} />
          <main id="main" tabIndex={-1} className="pointer-events-none relative z-10">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
