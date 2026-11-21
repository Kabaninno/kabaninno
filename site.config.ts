/**
 * Single place for studio-wide placeholders and settings.
 * Replace the bracketed values before going live.
 */
export const siteConfig = {
  studioName: 'KABANINNO',
  /** Telegram username without "@". TODO: replace the placeholder. */
  telegramUsername: '[TELEGRAM_USERNAME]',
  /** Production domain without protocol, e.g. "example.com". TODO: replace the placeholder. */
  domain: '[ДОМЕН]',
  /** Currency used by configurator budget ranges. */
  currency: 'PLN',
} as const;

export type SiteConfig = typeof siteConfig;
