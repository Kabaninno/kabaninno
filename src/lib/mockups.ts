/**
 * Interactive demo mockups of the portfolio (BRIEF: one of three demo
 * types). Data and pure logic only; the components are in
 * `components/portfolio/demo/`. All visible words are resolved on the server
 * (`buildMockupLabels`) and passed as plain strings; numbers are formatted
 * there too, so the browser needs no Intl formatter.
 */
import type { ProjectDemo } from '~/content';

export type MockupVariant = Extract<ProjectDemo, { type: 'mockup' }>['variant'];

/* ------------------------------------------------------------------ */
/* Telegram chat                                                       */
/* ------------------------------------------------------------------ */

export const CHAT_OPTIONS = ['order', 'status', 'hours'] as const;
export type ChatOption = (typeof CHAT_OPTIONS)[number];

export type ChatMessage =
  { from: 'bot'; text: 'greeting' | ChatOption } | { from: 'user'; text: ChatOption };

/** Visible conversation length; older messages scroll out. */
export const CHAT_HISTORY = 6;

export const chatStart = (): ChatMessage[] => [{ from: 'bot', text: 'greeting' }];

/** The visitor taps a quick reply: their message, then the bot's answer. */
export function chatStep(messages: readonly ChatMessage[], option: ChatOption): ChatMessage[] {
  return [
    ...messages,
    { from: 'user', text: option } as const,
    { from: 'bot', text: option } as const,
  ].slice(-CHAT_HISTORY);
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export const DASHBOARD_PERIODS = ['week', 'month'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_DATA: Record<
  DashboardPeriod,
  { leads: number; conversion: number; revenue: number; bars: number[] }
> = {
  week: { leads: 48, conversion: 0.21, revenue: 18400, bars: [5, 7, 6, 9, 8, 4, 9] },
  month: { leads: 196, conversion: 0.24, revenue: 76500, bars: [38, 45, 52, 61] },
};

/** Bar heights as a share of the tallest bar (0..1). */
export function barShares(values: readonly number[]): number[] {
  const max = Math.max(...values, 1);
  return values.map((value) => value / max);
}

/* ------------------------------------------------------------------ */
/* Booking                                                             */
/* ------------------------------------------------------------------ */

/** Slots of the 5 weekdays shown; `false` = already taken. */
export const BOOKING_TIMES = ['08:00', '10:00', '12:00', '17:00', '19:00'] as const;
export const BOOKING_TAKEN: readonly (readonly string[])[] = [
  ['10:00'],
  ['08:00', '17:00'],
  [],
  ['12:00', '19:00'],
  ['08:00'],
];

export function isSlotFree(day: number, time: string): boolean {
  return !(BOOKING_TAKEN[day] ?? []).includes(time);
}

/* ------------------------------------------------------------------ */
/* Storefront                                                          */
/* ------------------------------------------------------------------ */

/** Product codes (no translation needed) and prices in PLN. */
export const STORE_PRODUCTS = [
  { id: 'a', code: 'Model A', price: 129 },
  { id: 'b', code: 'Model B', price: 189 },
  { id: 'c', code: 'Model C', price: 249 },
] as const;

export function cartTotal(cart: Readonly<Record<string, number>>): number {
  return STORE_PRODUCTS.reduce((sum, product) => sum + (cart[product.id] ?? 0) * product.price, 0);
}

/* ------------------------------------------------------------------ */
/* Labels (server)                                                     */
/* ------------------------------------------------------------------ */

type Translate = (key: string, values?: Record<string, string | number>) => string;
type RawTranslate = (key: string) => string;

export interface MockupLabels {
  chat: {
    title: string;
    status: string;
    input: string;
    reset: string;
    messages: Record<'greeting' | ChatOption, string>;
    options: Record<ChatOption, string>;
  };
  dashboard: {
    title: string;
    period: string;
    periods: Record<DashboardPeriod, string>;
    leads: string;
    conversion: string;
    revenue: string;
    chart: string;
    values: Record<DashboardPeriod, { leads: string; conversion: string; revenue: string }>;
    bars: Record<DashboardPeriod, string[]>;
  };
  booking: {
    title: string;
    day: string;
    time: string;
    book: string;
    /** Raw template with `{day}` and `{time}` (filled in the browser). */
    booked: string;
    taken: string;
    days: string[];
  };
  store: {
    title: string;
    add: string;
    remove: string;
    cart: string;
    empty: string;
    prices: Record<string, string>;
    total: Record<number, string>;
  };
}

/**
 * Words and formatted numbers of every mockup for one locale (`portfolio`
 * namespace translator `t`, its raw accessor for templates).
 */
export function buildMockupLabels(locale: string, t: Translate, raw: RawTranslate): MockupLabels {
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const money = (value: number) => `${integer.format(value)} PLN`;
  // A fixed Monday (2024-01-01) gives the locale's short weekday names.
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const weekdays = Array.from({ length: 7 }, (_, day) =>
    weekday.format(new Date(Date.UTC(2024, 0, 1 + day))),
  );
  const totals = new Set<number>([0]);
  // Every cart total reachable with up to 3 of each product.
  for (let a = 0; a <= 3; a += 1)
    for (let b = 0; b <= 3; b += 1)
      for (let c = 0; c <= 3; c += 1)
        totals.add(
          a * STORE_PRODUCTS[0].price + b * STORE_PRODUCTS[1].price + c * STORE_PRODUCTS[2].price,
        );

  return {
    chat: {
      title: t('mockups.chat.title'),
      status: t('mockups.chat.status'),
      input: t('mockups.chat.input'),
      reset: t('mockups.chat.reset'),
      messages: {
        greeting: t('mockups.chat.greeting'),
        order: t('mockups.chat.replies.order'),
        status: t('mockups.chat.replies.status'),
        hours: t('mockups.chat.replies.hours'),
      },
      options: {
        order: t('mockups.chat.options.order'),
        status: t('mockups.chat.options.status'),
        hours: t('mockups.chat.options.hours'),
      },
    },
    dashboard: {
      title: t('mockups.dashboard.title'),
      period: t('mockups.dashboard.period'),
      periods: { week: t('mockups.dashboard.week'), month: t('mockups.dashboard.month') },
      leads: t('mockups.dashboard.leads'),
      conversion: t('mockups.dashboard.conversion'),
      revenue: t('mockups.dashboard.revenue'),
      chart: t('mockups.dashboard.chart'),
      values: Object.fromEntries(
        Object.entries(DASHBOARD_DATA).map(([period, data]) => [
          period,
          {
            leads: integer.format(data.leads),
            conversion: percent.format(data.conversion),
            revenue: money(data.revenue),
          },
        ]),
      ) as MockupLabels['dashboard']['values'],
      bars: { week: weekdays, month: ['1–7', '8–14', '15–21', '22–28'] },
    },
    booking: {
      title: t('mockups.booking.title'),
      day: t('mockups.booking.day'),
      time: t('mockups.booking.time'),
      book: t('mockups.booking.book'),
      booked: raw('mockups.booking.booked'),
      taken: t('mockups.booking.taken'),
      days: weekdays.slice(0, 5),
    },
    store: {
      title: t('mockups.store.title'),
      add: t('mockups.store.add'),
      remove: t('mockups.store.remove'),
      cart: t('mockups.store.cart'),
      empty: t('mockups.store.empty'),
      prices: Object.fromEntries(
        STORE_PRODUCTS.map((product) => [product.id, money(product.price)]),
      ),
      total: Object.fromEntries([...totals].map((total) => [total, money(total)])),
    },
  };
}
