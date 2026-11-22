import { describe, expect, it } from 'vitest';
import { siteConfig } from '~/site.config';
import {
  WHATSAPP_URL_BUDGET,
  isValidWhatsappNumber,
  prepareWhatsappLink,
  whatsappUrl,
} from './whatsapp';

describe('WhatsApp link (round 3, B4)', () => {
  it('accepts digits with the country code only', () => {
    expect(isValidWhatsappNumber('48123456789')).toBe(true);
    for (const value of ['', '+48123456789', '48 123 456 789', '048123456', '123', 'abc']) {
      expect(isValidWhatsappNumber(value), value).toBe(false);
    }
  });

  it('builds wa.me with the encoded text', () => {
    expect(whatsappUrl('48123456789', 'Dzień dobry!\nMam na imię Ola.')).toBe(
      'https://wa.me/48123456789?text=Dzie%C5%84%20dobry!%0AMam%20na%20imi%C4%99%20Ola.',
    );
  });

  it('is not configured while the number is empty (no button, D157)', () => {
    expect(prepareWhatsappLink('', 'text')).toBeNull();
    expect(
      siteConfig.whatsappNumber === '' || isValidWhatsappNumber(siteConfig.whatsappNumber),
    ).toBe(true);
  });

  it('keeps the link within the budget, shortening the text when needed', () => {
    const short = prepareWhatsappLink('48123456789', 'Krótko.');
    expect(short).toMatchObject({ text: 'Krótko.', truncated: false });
    const long = prepareWhatsappLink('48123456789', 'Дуже довгий текст. '.repeat(100))!;
    expect(long.truncated).toBe(true);
    expect(long.text.endsWith('…')).toBe(true);
    expect(long.url.length).toBeLessThanOrEqual(WHATSAPP_URL_BUDGET);
  });
});
