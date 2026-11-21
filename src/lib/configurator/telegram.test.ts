import { describe, expect, it } from 'vitest';
import {
  TELEGRAM_URL_BUDGET,
  fitTextToTelegramUrl,
  fitsTelegramBudget,
  isValidTelegramUsername,
  normalizeUsername,
  telegramText,
  telegramUrl,
} from './telegram';

describe('telegram link', () => {
  it('builds https://t.me/<username>?text=<encoded>', () => {
    expect(telegramUrl('kabaninno_studio', 'Cześć, potrzebuję sklepu')).toBe(
      'https://t.me/kabaninno_studio?text=Cze%C5%9B%C4%87%2C%20potrzebuj%C4%99%20sklepu',
    );
  });

  it('encodes Cyrillic and newlines as UTF-8', () => {
    const url = telegramUrl('studio_ua', 'Привіт\nї є ґ');
    expect(url).toBe(
      'https://t.me/studio_ua?text=%D0%9F%D1%80%D0%B8%D0%B2%D1%96%D1%82%0A%D1%97%20%D1%94%20%D2%91',
    );
    expect(decodeURIComponent(url.split('text=')[1]!)).toBe('Привіт\nї є ґ');
  });

  it('prepends a space when the text starts with "@"', () => {
    expect(telegramText('@studio please')).toBe(' @studio please');
    expect(telegramUrl('studio_x', '@x')).toBe('https://t.me/studio_x?text=%20%40x');
  });

  it('sends no-break spaces as plain spaces (D35)', () => {
    expect(telegramUrl('studio_x', 'w\u00A0domu')).toBe('https://t.me/studio_x?text=w%20domu');
  });

  it('strips a leading "@" from the username', () => {
    expect(normalizeUsername(' @studio_x ')).toBe('studio_x');
    expect(telegramUrl('@studio_x', 'a')).toBe('https://t.me/studio_x?text=a');
  });

  it('validates usernames (the placeholder is not one)', () => {
    expect(isValidTelegramUsername('kabaninno')).toBe(true);
    expect(isValidTelegramUsername('studio_2025')).toBe(true);
    expect(isValidTelegramUsername('[TELEGRAM_USERNAME]')).toBe(false);
    expect(isValidTelegramUsername('abc')).toBe(false);
    expect(isValidTelegramUsername('1studio')).toBe(false);
  });
});

describe('URL budget', () => {
  it('measures the whole URL', () => {
    expect(fitsTelegramBudget('studio_x', 'a', 'https://t.me/studio_x?text=a'.length)).toBe(true);
    expect(fitsTelegramBudget('studio_x', 'ab', 'https://t.me/studio_x?text=a'.length)).toBe(false);
  });

  it('leaves fitting texts untouched', () => {
    expect(fitTextToTelegramUrl('studio_x', 'Krótko.')).toEqual({
      text: 'Krótko.',
      truncated: false,
    });
  });

  it('cuts long Ukrainian text to the budget, grapheme-safe, with an ellipsis', () => {
    const text = 'Потрібен бот для запису клієнтів і нагадувань. '.repeat(40);
    const fitted = fitTextToTelegramUrl('studio_ua', text);
    expect(fitted.truncated).toBe(true);
    expect(fitted.text.endsWith('…')).toBe(true);
    expect(telegramUrl('studio_ua', fitted.text).length).toBeLessThanOrEqual(TELEGRAM_URL_BUDGET);
    // As long as possible: one more character would not fit.
    const longer = text.slice(0, fitted.text.length) + '…';
    expect(telegramUrl('studio_ua', longer).length).toBeGreaterThan(TELEGRAM_URL_BUDGET);
  });

  it('never splits emoji when cutting', () => {
    const fitted = fitTextToTelegramUrl('studio_x', '👩‍💻'.repeat(400), 500);
    expect(fitted.truncated).toBe(true);
    expect(fitted.text.replace(/…$/, '').match(/👩‍💻/g)!.join('')).toBe(
      fitted.text.replace(/…$/, ''),
    );
    expect(telegramUrl('studio_x', fitted.text).length).toBeLessThanOrEqual(500);
  });
});
