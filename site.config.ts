/**
 * Single place for studio-wide placeholders and settings.
 * Replace the bracketed values before going live.
 */
export const siteConfig = {
  studioName: 'KABANINNO',
  /** Telegram username without "@" (https://t.me/wa1demarr). */
  telegramUsername: 'wa1demarr',
  /**
   * WhatsApp number for "Send via WhatsApp": digits only, with the country
   * code, no "+" or spaces (e.g. "48123456789"). Empty: the button is hidden.
   */
  whatsappNumber: '',
  /** Production domain without protocol, e.g. "example.com". TODO: replace the placeholder. */
  domain: '[ДОМЕН]',
  /** Currency of the configurator estimate (service prices are in PLN). */
  currency: 'PLN',
} as const;

export type SiteConfig = typeof siteConfig;
