'use client';

import { useState } from 'react';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import {
  BOOKING_TIMES,
  CHAT_OPTIONS,
  DASHBOARD_DATA,
  DASHBOARD_PERIODS,
  STORE_PRODUCTS,
  barShares,
  cartTotal,
  chatStart,
  chatStep,
  isSlotFree,
  type DashboardPeriod,
  type MockupLabels,
  type MockupVariant,
} from '@/lib/mockups';
import { fillTemplate } from '@/lib/portfolio';

/**
 * Interactive HTML/CSS mockups of the portfolio demos: small, keyboard-usable
 * (native buttons and radios), no external assets, words from `labels`.
 */
export function MockupDemo({ variant, labels }: { variant: MockupVariant; labels: MockupLabels }) {
  switch (variant) {
    case 'telegram-chat':
      return <ChatMockup labels={labels.chat} />;
    case 'dashboard':
      return <DashboardMockup labels={labels.dashboard} />;
    case 'booking':
      return <BookingMockup labels={labels.booking} />;
    case 'storefront':
      return <StoreMockup labels={labels.store} />;
  }
}

const frame = 'rounded-2xl border border-white/10 bg-[linear-gradient(160deg,#0c1328,#070a14)] p-4';

const pill =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-3 text-xs transition-colors duration-150 md:min-h-9 md:pointer-coarse:min-h-11 ' +
  'border-white/12 text-ink/90 hover:border-white/30 has-[:checked]:border-[var(--accent,var(--color-brand))] has-[:checked]:bg-[color-mix(in_srgb,var(--accent,var(--color-brand))_16%,transparent)] has-[:checked]:text-ink ' +
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40';

function ChatMockup({ labels }: { labels: MockupLabels['chat'] }) {
  const [messages, setMessages] = useState(chatStart);
  return (
    <div className={`${frame} mx-auto max-w-sm`}>
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] pb-3">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--accent,var(--color-brand))_30%,transparent)] text-xs"
        >
          ◆
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium text-ink">{labels.title}</span>
          <span className="text-[0.6875rem] text-[var(--accent,var(--color-brand))]">
            {labels.status}
          </span>
        </span>
      </div>
      {/* Top-aligned: the bot's greeting is the first thing under the header (V5-07). */}
      <ol role="log" className="flex min-h-48 flex-col justify-start gap-2 py-3">
        {messages.map((message, index) => (
          <li
            key={index}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
              message.from === 'bot'
                ? 'self-start rounded-bl-md bg-white/[0.07] text-ink'
                : 'self-end rounded-br-md bg-[color-mix(in_srgb,var(--accent,var(--color-brand))_28%,transparent)] text-ink'
            }`}
          >
            {message.from === 'bot' ? labels.messages[message.text] : labels.options[message.text]}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-1.5">
        {CHAT_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMessages((current) => chatStep(current, option))}
            className={`${secondaryButton} min-h-11 px-3 text-xs md:min-h-9 md:pointer-coarse:min-h-11`}
          >
            {labels.options[option]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-9 flex-1 items-center rounded-full border border-white/10 px-3 text-xs text-faint"
        >
          {labels.input}
        </span>
        <button
          type="button"
          onClick={() => setMessages(chatStart())}
          className="min-h-9 rounded-full px-2 text-xs text-muted underline decoration-white/25 underline-offset-4 hover:text-ink pointer-coarse:min-h-11"
        >
          {labels.reset}
        </button>
      </div>
    </div>
  );
}

function DashboardMockup({ labels }: { labels: MockupLabels['dashboard'] }) {
  const [period, setPeriod] = useState<DashboardPeriod>('week');
  const values = labels.values[period];
  const shares = barShares(DASHBOARD_DATA[period].bars);
  return (
    <div className={frame}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{labels.title}</p>
        <fieldset className="flex gap-1">
          <legend className="sr-only">{labels.period}</legend>
          {DASHBOARD_PERIODS.map((id) => (
            <label key={id} className={pill}>
              <input
                type="radio"
                name="mockup-period"
                value={id}
                checked={period === id}
                onChange={() => setPeriod(id)}
                className="sr-only"
              />
              {labels.periods[id]}
            </label>
          ))}
        </fieldset>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {(
          [
            [labels.leads, values.leads],
            [labels.conversion, values.conversion],
            [labels.revenue, values.revenue],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/[0.07] px-2.5 py-2">
            <dt className="text-[0.6875rem] text-muted">{label}</dt>
            <dd className="mt-0.5 font-display text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <figure className="mt-4">
        <figcaption className="mb-2 text-[0.6875rem] text-muted">{labels.chart}</figcaption>
        <ul className="flex h-28 items-end gap-1.5">
          {shares.map((share, index) => (
            <li key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span
                aria-hidden="true"
                style={{ height: `${Math.max(share * 100, 4)}%` }}
                className="w-full rounded-t-md bg-[linear-gradient(180deg,var(--accent,var(--color-brand)),color-mix(in_srgb,var(--accent,var(--color-brand))_25%,transparent))] transition-[height] duration-300 ease-calm"
              />
              <span className="text-[0.625rem] text-faint">
                {labels.bars[period][index]}
                <span className="sr-only">: {DASHBOARD_DATA[period].bars[index]}</span>
              </span>
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}

function BookingMockup({ labels }: { labels: MockupLabels['booking'] }) {
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState('');
  return (
    <div className={frame}>
      <p className="text-sm font-medium text-ink">{labels.title}</p>
      <fieldset className="mt-3">
        <legend className="mb-1.5 text-[0.6875rem] text-muted">{labels.day}</legend>
        <div className="flex flex-wrap gap-1.5">
          {labels.days.map((name, index) => (
            <label key={name} className={pill}>
              <input
                type="radio"
                name="mockup-day"
                checked={day === index}
                onChange={() => {
                  setDay(index);
                  setTime(null);
                  setBooked('');
                }}
                className="sr-only"
              />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-3" disabled={day === null}>
        <legend className="mb-1.5 text-[0.6875rem] text-muted">{labels.time}</legend>
        <div className="flex flex-wrap gap-1.5">
          {BOOKING_TIMES.map((slot) => {
            const free = day !== null && isSlotFree(day, slot);
            return (
              <label key={slot} className={pill}>
                <input
                  type="radio"
                  name="mockup-time"
                  checked={time === slot}
                  disabled={!free}
                  onChange={() => {
                    setTime(slot);
                    setBooked('');
                  }}
                  className="sr-only"
                />
                <span className="font-mono">{slot}</span>
                {day !== null && !free ? (
                  <span className="ml-1 text-faint">· {labels.taken}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      <button
        type="button"
        disabled={day === null || time === null}
        onClick={() =>
          setBooked(fillTemplate(labels.booked, { day: labels.days[day!] ?? '', time: time ?? '' }))
        }
        className={`${primaryButton} mt-4 min-h-11 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {labels.book}
      </button>
      <p role="status" className="mt-2 min-h-5 text-sm text-[var(--accent,var(--color-brand))]">
        {booked}
      </p>
    </div>
  );
}

const MAX_PER_PRODUCT = 3;

function StoreMockup({ labels }: { labels: MockupLabels['store'] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const total = cartTotal(cart);
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0);
  const change = (id: string, delta: number) =>
    setCart((current) => ({
      ...current,
      [id]: Math.min(MAX_PER_PRODUCT, Math.max(0, (current[id] ?? 0) + delta)),
    }));
  return (
    <div className={frame}>
      <p className="text-sm font-medium text-ink">{labels.title}</p>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {STORE_PRODUCTS.map((product) => (
          <li
            key={product.id}
            className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] p-2"
          >
            <span
              aria-hidden="true"
              className="aspect-square rounded-lg bg-[radial-gradient(circle_at_35%_30%,color-mix(in_srgb,var(--accent,var(--color-brand))_45%,transparent),transparent_65%),#0a1024]"
            />
            <span className="text-xs text-ink">{product.code}</span>
            <span className="text-[0.6875rem] text-muted">{labels.prices[product.id]}</span>
            <button
              type="button"
              onClick={() => change(product.id, 1)}
              disabled={(cart[product.id] ?? 0) >= MAX_PER_PRODUCT}
              className={`${secondaryButton} min-h-11 px-2 text-[0.6875rem] disabled:opacity-40 md:min-h-8 md:pointer-coarse:min-h-11`}
            >
              {labels.add}
              <span className="sr-only">: {product.code}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3 text-sm">
        <p role="status" className="text-ink">
          {labels.cart}: {count > 0 ? `${count} · ${labels.total[total] ?? ''}` : labels.empty}
        </p>
        {count > 0 ? (
          <button
            type="button"
            onClick={() => setCart({})}
            className="min-h-9 rounded-full px-2 text-xs text-muted underline decoration-white/25 underline-offset-4 hover:text-ink pointer-coarse:min-h-11"
          >
            {labels.remove}
          </button>
        ) : null}
      </div>
    </div>
  );
}
