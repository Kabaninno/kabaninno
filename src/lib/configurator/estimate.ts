import { timelineDisplay } from '../timeline';

/**
 * Indicative price and timeline of a set of services (round 3, B2, D156).
 * Pure and client-safe: the wizard recomputes it as services are removed or
 * added.
 */

/** Price and timeline of one service: `[min, max]` each (content `pricePLN`, `timelineDays`). */
export interface Priced {
  price: readonly [number, number];
  days: readonly [number, number];
}

export interface Estimate {
  /** Sum of the minimums and sum of the maximums, rounded to 100. */
  price: [number, number];
  /** Days, `[min, max]`: never shorter than the longest service, otherwise 70 % of the sum. */
  days: [number, number];
}

/** Parallel work: several services take this share of the summed time. */
export const TIMELINE_OVERLAP = 0.7;
/** Prices are rounded to this step. */
export const PRICE_STEP = 100;

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * The estimate of these services, or `null` for none (a consultation):
 * - price: sum of the minimums and sum of the maximums, rounded to 100;
 * - timeline: `min = max(largest min, round(0.7 × sum of mins))`, the same for `max`.
 */
export function estimate(services: readonly Priced[]): Estimate | null {
  if (services.length === 0) return null;
  let priceMin = 0;
  let priceMax = 0;
  let daysMin = 0;
  let daysMax = 0;
  let longestMin = 0;
  let longestMax = 0;
  for (const { price, days } of services) {
    priceMin += price[0];
    priceMax += price[1];
    daysMin += days[0];
    daysMax += days[1];
    longestMin = Math.max(longestMin, days[0]);
    longestMax = Math.max(longestMax, days[1]);
  }
  return {
    price: [roundTo(priceMin, PRICE_STEP), roundTo(priceMax, PRICE_STEP)],
    days: [
      Math.max(longestMin, Math.round(TIMELINE_OVERLAP * daysMin)),
      Math.max(longestMax, Math.round(TIMELINE_OVERLAP * daysMax)),
    ],
  };
}

/**
 * "1 800–4 000 zł": `Intl.NumberFormat` in the interface locale, no decimals.
 * The narrow symbol ("zł") in every locale, as in the owner's example; the
 * grouping follows the locale (Polish does not group four-digit numbers).
 */
export function formatPriceRange(
  [min, max]: readonly [number, number],
  locale: string,
  currency: string,
): string {
  const format = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  });
  return min === max ? format.format(min) : format.formatRange(min, max);
}

/**
 * Timeline phrases formatted on the server (the client never formats ICU):
 * per unit, the phrase for a range ending in `n` with a `{min}` placeholder
 * ("{min}–5 днів"), and the phrase for exactly `n` ("2 тижні"), indexed by `n`.
 */
export interface TimelineTexts {
  days: Record<number, string>;
  weeks: Record<number, string>;
  daysExact: Record<number, string>;
  weeksExact: Record<number, string>;
}

/**
 * "3–7 днів" / "1–2 тижні": days up to ten, weeks above (the service pages'
 * rule, D146). A week range that rounds to one number reads as that number.
 */
export function formatTimeline(days: readonly [number, number], texts: TimelineTexts): string {
  const { unit, min, max } = timelineDisplay(days);
  if (min === max) return (unit === 'days' ? texts.daysExact : texts.weeksExact)[max] ?? '';
  const template = (unit === 'days' ? texts.days : texts.weeks)[max];
  return template ? template.replace('{min}', String(min)) : '';
}
