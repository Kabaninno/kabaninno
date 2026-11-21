import type { Metadata } from 'next';
import { siteConfig } from '~/site.config';
import { defaultLocale, locales, type Locale } from '@/i18n/routing';
import { absoluteUrl } from './site-url';

const OG_LOCALE: Record<Locale, string> = { pl: 'pl_PL', en: 'en_US', uk: 'uk_UA' };

/** Locale-prefixed path, e.g. ("pl", "/services/web/") → "/pl/services/web/". */
export function localizedPath(locale: Locale, path: string): string {
  return `/${locale}${path === '/' ? '/' : path}`;
}

/** hreflang map for one locale-less path, including x-default. */
export function languageAlternates(path: string): Record<string, string> {
  const entries = locales.map((locale) => [locale, absoluteUrl(localizedPath(locale, path))]);
  return {
    ...Object.fromEntries(entries),
    'x-default': absoluteUrl(localizedPath(defaultLocale, path)),
  };
}

interface PageMetadataInput {
  locale: Locale;
  /** Locale-less path with trailing slash, e.g. "/services/web/". */
  path: string;
  title: string;
  description: string;
  /** Use the title as-is (no " · Studio" suffix from the template). */
  absoluteTitle?: boolean;
  noIndex?: boolean;
}

export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(localizedPath(locale, path));
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: siteConfig.studioName,
      locale: OG_LOCALE[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
    },
    twitter: { card: 'summary_large_image', title, description },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
