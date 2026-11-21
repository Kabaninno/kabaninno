import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/routing';

/**
 * Apostrophes in the dictionaries (D38):
 * - Ukrainian uses the typographic ’ (U+2019) inside words (об’єкт, з’явиться).
 *   The ASCII ' (U+0027) and the modifier letter ʼ (U+02BC) are not allowed
 *   there: ʼ is not guaranteed in our fonts, and ' doubles as the ICU escape.
 *   Look-alikes (‘ ` ´) are rejected for the same reason.
 * - No locale may put an ASCII ' right next to { or }: in ICU MessageFormat
 *   (next-intl) '{ starts a quoted literal, so the placeholder would be
 *   printed verbatim or the message would fail to parse.
 */

const messagesDir = join(process.cwd(), 'messages');

interface Entry {
  file: string;
  key: string;
  value: string;
}

function collect(value: unknown, file: string, prefix: string, out: Entry[]): void {
  if (typeof value === 'string') {
    out.push({ file, key: prefix, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, file, `${prefix}[${index}]`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      collect(item, file, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

function entriesFor(locale: string): Entry[] {
  const dir = join(messagesDir, locale);
  const out: Entry[] = [];
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.json'))) {
    const file = `messages/${locale}/${name}`;
    collect(JSON.parse(readFileSync(join(dir, name), 'utf8')), file, '', out);
  }
  return out;
}

const describeHit = ({ file, key, value }: Entry) => `${file} → ${key}: ${JSON.stringify(value)}`;

/** A wrong apostrophe between two letters (any script). */
const WRONG_IN_WORD = /\p{L}['ʼ‘`´]\p{L}/u;
/** An ASCII apostrophe touching an ICU brace on either side. */
const QUOTE_NEXT_TO_BRACE = /'[{}]|[{}]'/;

describe('apostrophes in dictionaries', () => {
  it('finds the dictionaries', () => {
    for (const locale of locales) expect(entriesFor(locale).length).toBeGreaterThan(50);
  });

  it('uses only ’ (U+2019) inside Ukrainian words', () => {
    const hits = entriesFor('uk').filter((entry) => WRONG_IN_WORD.test(entry.value));
    expect(hits.map(describeHit)).toEqual([]);
  });

  it.each(locales)('never puts an ASCII apostrophe next to { or } (%s)', (locale) => {
    const hits = entriesFor(locale).filter((entry) => QUOTE_NEXT_TO_BRACE.test(entry.value));
    expect(hits.map(describeHit)).toEqual([]);
  });

  it('the patterns catch what they should', () => {
    expect(WRONG_IN_WORD.test("об'єкт")).toBe(true);
    expect(WRONG_IN_WORD.test('обʼєкт')).toBe(true);
    expect(WRONG_IN_WORD.test('об’єкт')).toBe(false);
    expect(QUOTE_NEXT_TO_BRACE.test("'{studio}")).toBe(true);
    expect(QUOTE_NEXT_TO_BRACE.test("{studio}'s")).toBe(true);
    expect(QUOTE_NEXT_TO_BRACE.test("don't {count}")).toBe(false);
  });
});
