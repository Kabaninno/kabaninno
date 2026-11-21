import { getCategories } from '~/content';
import { siteConfig } from '~/site.config';
import { getMessagesFor } from '@/i18n/messages';
import { locales, type Locale } from '@/i18n/routing';
import { isValidTelegramUsername, normalizeUsername } from './configurator/telegram';
import { getCategoryText, getServiceText } from './content-text';
import { localizedPath, ogImagePath } from './metadata';
import { paths } from './routes';
import { SITE_URL, absoluteUrl } from './site-url';

/**
 * schema.org JSON-LD for the home pages (server only). Deliberately an
 * `Organization`, not a `LocalBusiness`/`ProfessionalService`: those expect
 * a street address, and the studio has none to publish — nothing here is
 * invented. Contacts come from site.config.ts only, and only once they are
 * real (the Telegram placeholder is left out). The service catalogue is
 * built from content, like the site itself.
 */
export function homeJsonLd(locale: Locale): Record<string, unknown> {
  const ui = getMessagesFor(locale);
  const studio = siteConfig.studioName;
  const home = absoluteUrl(localizedPath(locale, paths.home()));
  const telegram = normalizeUsername(siteConfig.telegramUsername);
  const sameAs = isValidTelegramUsername(telegram) ? [`https://t.me/${telegram}`] : undefined;
  const organizationId = `${SITE_URL}/#organization`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: studio,
        url: home,
        description: ui.meta.homeDescription,
        image: absoluteUrl(ogImagePath(locale)),
        knowsLanguage: [...locales],
        ...(sameAs ? { sameAs } : {}),
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: ui.hud.services,
          itemListElement: getCategories().map((category) => ({
            '@type': 'OfferCatalog',
            name: getCategoryText(locale, category.id).name,
            url: absoluteUrl(localizedPath(locale, paths.category(category.id))),
            itemListElement: category.services.map((service) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: getServiceText(locale, category.id, service.slug).title,
                url: absoluteUrl(localizedPath(locale, paths.service(category.id, service.slug))),
              },
            })),
          })),
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: home,
        name: studio,
        inLanguage: locale,
        publisher: { '@id': organizationId },
      },
    ],
  };
}

/**
 * Serialises JSON-LD for an inline `<script type="application/ld+json">`:
 * `<` is escaped, so no string in the data can close the script element.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
