import { describe, expect, it } from 'vitest';
import { graphemes, normalizeSpaces, truncateGraphemes } from './text';

const wellFormed = (text: string) =>
  !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);

describe('normalizeSpaces', () => {
  it('turns no-break spaces from typography and number formatting into spaces', () => {
    expect(normalizeSpaces('w\u00A0jeden 15\u202F000 PLN 1\u2007000')).toBe(
      'w jeden 15 000 PLN 1 000',
    );
  });
});

describe('graphemes', () => {
  const samples = ['Łódź', 'Привіт', 'é', '👍🏽', '👩‍💻', '🇵🇱'];

  it('keeps clusters whole with Intl.Segmenter', () => {
    expect(graphemes('e\u0301a')).toEqual(['e\u0301', 'a']);
    expect(graphemes('👍🏽👩‍💻🇵🇱')).toEqual(['👍🏽', '👩‍💻', '🇵🇱']);
  });

  it('falls back to code points with marks and joiners attached', () => {
    expect(graphemes('e\u0301a', null)).toEqual(['e\u0301', 'a']);
    expect(graphemes('👩‍💻x', null)).toEqual(['👩‍💻', 'x']);
    for (const sample of samples) expect(graphemes(sample, null).join('')).toBe(sample);
  });
});

describe('truncateGraphemes', () => {
  it('leaves short texts alone', () => {
    expect(truncateGraphemes('Łódź', 4)).toBe('Łódź');
  });

  it('cuts at cluster boundaries and adds an ellipsis', () => {
    expect(truncateGraphemes('Załóż sklep', 6)).toBe('Załóż…');
    expect(truncateGraphemes('Привіт світ', 3)).toBe('При…');
    expect(truncateGraphemes('ok 👍🏽👍🏽', 4)).toBe('ok 👍🏽…');
    expect(truncateGraphemes('cafe\u0301 au lait', 4)).toBe('cafe\u0301…');
  });

  it('never leaves a broken surrogate pair, in either mode', () => {
    for (let count = 0; count < 6; count += 1) {
      expect(wellFormed(truncateGraphemes('🇵🇱👩‍💻😀ąę', count))).toBe(true);
      expect(wellFormed(truncateGraphemes('🇵🇱👩‍💻😀ąę', count, '…', null))).toBe(true);
    }
  });
});
