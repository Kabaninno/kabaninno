import { describe, expect, it } from 'vitest';
import { bindShortWords } from './typography';

const NBSP = ' ';

describe('bindShortWords', () => {
  it('binds Polish one-letter words to the next word', () => {
    expect(bindShortWords('Łączymy Twój biznes w jeden system', 'pl')).toBe(
      `Łączymy Twój biznes w${NBSP}jeden system`,
    );
    expect(bindShortWords('Sprzedaż i zamówienia', 'pl')).toBe(`Sprzedaż i${NBSP}zamówienia`);
  });

  it('handles runs of one-letter words and the start of the text', () => {
    expect(bindShortWords('A i w domu', 'pl')).toBe(`A${NBSP}i${NBSP}w${NBSP}domu`);
    expect(bindShortWords('Z nami o krok dalej', 'pl')).toBe(`Z${NBSP}nami o${NBSP}krok dalej`);
  });

  it('binds Ukrainian one-letter words (Cyrillic)', () => {
    expect(bindShortWords('Поєднуємо ваш бізнес в єдину систему', 'uk')).toBe(
      `Поєднуємо ваш бізнес в${NBSP}єдину систему`,
    );
    expect(bindShortWords('Сповіщення й нагадування', 'uk')).toBe(`Сповіщення й${NBSP}нагадування`);
    expect(bindShortWords('AI та Telegram-боти — у вашому бізнесі', 'uk')).toBe(
      `AI та Telegram-боти — у${NBSP}вашому бізнесі`,
    );
  });

  it('does not touch letters inside words or English text', () => {
    expect(bindShortWords('Strony WWW, CRM i AI', 'pl')).toBe(`Strony WWW, CRM i${NBSP}AI`);
    expect(bindShortWords('Prawo i', 'pl')).toBe('Prawo i');
    expect(bindShortWords('Build a system with AI', 'en')).toBe('Build a system with AI');
  });
});
