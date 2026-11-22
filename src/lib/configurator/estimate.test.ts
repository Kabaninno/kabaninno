import { describe, expect, it } from 'vitest';
import { estimate, formatPriceRange, formatTimeline, type TimelineTexts } from './estimate';
import { allServices, findService, getConfiguratorModel } from './model';

const model = getConfiguratorModel();
const service = (id: string) => findService(model, id)!;

describe('estimate', () => {
  it('is null without services (a consultation)', () => {
    expect(estimate([])).toBeNull();
  });

  it('one service: its own price and timeline', () => {
    expect(estimate([service('web/landing-pages')])).toEqual({ price: [400, 800], days: [2, 5] });
    expect(estimate([service('web/web-apps')])).toEqual({ price: [2000, 4000], days: [14, 30] });
  });

  it('sums the prices; the timeline is 70 % of the sum, never below the longest service', () => {
    // Landing page 400–800 / 2–5 + AI assistant 500–1 200 / 5–10 (prices of round 5).
    expect(estimate([service('web/landing-pages'), service('ai/ai-assistants')])).toEqual({
      price: [900, 2000],
      // min: max(5, round(0.7 × 7) = 5); max: max(10, round(0.7 × 15) = 11).
      days: [5, 11],
    });
    // Store 1 500–3 000 / 10–21 + integrations 300–1 000 / 2–7 + reminders 200–500 / 1–3.
    expect(
      estimate([
        service('web/online-stores'),
        service('automation/api-integrations'),
        service('automation/notifications-reminders'),
      ]),
    ).toEqual({ price: [2000, 4500], days: [10, 22] });
  });

  it('rounds prices to 100', () => {
    expect(
      estimate([
        { price: [1234, 2251], days: [1, 2] },
        { price: [10, 10], days: [1, 2] },
      ])?.price,
    ).toEqual([1200, 2300]);
  });

  it('every real service has a price and a timeline with min ≤ max', () => {
    for (const option of allServices(model)) {
      expect(option.price[0], option.id).toBeLessThanOrEqual(option.price[1]);
      expect(option.days[0], option.id).toBeLessThanOrEqual(option.days[1]);
    }
  });
});

describe('formatPriceRange', () => {
  it('formats in the interface locale with the złoty sign and no decimals', () => {
    const uk = formatPriceRange([1800, 4000], 'uk', 'PLN');
    expect(uk).toMatch(/^1\s800–4\s000\szł$/u);
    expect(formatPriceRange([1800, 4000], 'pl', 'PLN')).toMatch(/^1800–4000\szł$/u);
    expect(formatPriceRange([1800, 4000], 'en', 'PLN')).toMatch(/1,800–4,000/);
    expect(formatPriceRange([900, 900], 'pl', 'PLN')).toMatch(/^900\szł$/u);
  });
});

describe('formatTimeline', () => {
  const texts: TimelineTexts = {
    days: { 5: '{min}–5 днів', 11: 'x' },
    weeks: { 2: '{min}–2 тижні', 3: '{min}–3 тижні' },
    daysExact: {},
    weeksExact: { 2: '2 тижні' },
  };

  it('days up to ten, weeks above, like the service pages', () => {
    expect(formatTimeline([2, 5], texts)).toBe('2–5 днів');
    expect(formatTimeline([5, 11], texts)).toBe('1–2 тижні');
    expect(formatTimeline([10, 21], texts)).toBe('1–3 тижні');
  });

  it('a week range that rounds to one number reads as that number', () => {
    expect(formatTimeline([12, 16], texts)).toBe('2 тижні');
  });
});
