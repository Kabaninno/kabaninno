import { describe, expect, it } from 'vitest';
import {
  BOOKING_TIMES,
  CHAT_HISTORY,
  STORE_PRODUCTS,
  barShares,
  buildMockupLabels,
  cartTotal,
  chatStart,
  chatStep,
  isSlotFree,
} from './mockups';

describe('chat mockup', () => {
  it('answers a quick reply after echoing it', () => {
    expect(chatStep(chatStart(), 'status')).toEqual([
      { from: 'bot', text: 'greeting' },
      { from: 'user', text: 'status' },
      { from: 'bot', text: 'status' },
    ]);
  });

  it('keeps only the latest messages', () => {
    let messages = chatStart();
    for (let i = 0; i < 5; i += 1) messages = chatStep(messages, 'order');
    expect(messages).toHaveLength(CHAT_HISTORY);
    expect(messages.at(-1)).toEqual({ from: 'bot', text: 'order' });
  });
});

describe('dashboard mockup', () => {
  it('scales bars to the tallest one', () => {
    expect(barShares([2, 4, 8])).toEqual([0.25, 0.5, 1]);
    expect(barShares([0, 0])).toEqual([0, 0]);
  });
});

describe('booking mockup', () => {
  it('knows taken slots', () => {
    expect(isSlotFree(0, '10:00')).toBe(false);
    expect(isSlotFree(2, '10:00')).toBe(true);
    expect(BOOKING_TIMES).toContain('17:00');
  });
});

describe('storefront mockup', () => {
  it('sums the cart', () => {
    expect(cartTotal({})).toBe(0);
    expect(cartTotal({ a: 2, c: 1 })).toBe(2 * STORE_PRODUCTS[0].price + STORE_PRODUCTS[2].price);
  });
});

describe('buildMockupLabels', () => {
  const t = (key: string) => `«${key}»`;
  const raw = (key: string) => `${key}: {day} {time}`;

  it('formats numbers and weekdays for the locale', () => {
    const pl = buildMockupLabels('pl', t, raw);
    expect(pl.dashboard.values.week.revenue.replace(/\s/g, ' ')).toBe('18 400 PLN');
    expect(pl.dashboard.values.month.conversion).toMatch(/^24\s?%$/);
    expect(pl.booking.days).toHaveLength(5);
    expect(pl.dashboard.bars.week[0]!.toLowerCase()).toMatch(/^pon/);
    expect(buildMockupLabels('uk', t, raw).dashboard.bars.week[0]!.toLowerCase()).toMatch(/^пн/);
    expect(buildMockupLabels('en', t, raw).dashboard.values.week.revenue).toBe('18,400 PLN');
  });

  it('keeps the booking confirmation as a raw template and covers every cart total', () => {
    const labels = buildMockupLabels('pl', t, raw);
    expect(labels.booking.booked).toContain('{day}');
    expect(labels.store.total[cartTotal({ a: 3, b: 3, c: 3 })]).toBeTruthy();
    expect(labels.store.total[0]).toBeTruthy();
  });
});
