import { getRequestConfig } from 'next-intl/server';
import { getMessagesFor } from './messages';
import { defaultLocale, isLocale } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // With static export the locale always comes from `setRequestLocale()`.
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;
  return {
    locale,
    messages: getMessagesFor(locale),
    // Fixed zone so server (build) and client formatting agree.
    timeZone: 'Europe/Warsaw',
  };
});
