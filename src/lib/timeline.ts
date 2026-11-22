/** Longest delivery time (in days) that is still shown in days; anything longer is shown in weeks. */
export const MAX_DAYS_SHOWN_AS_DAYS = 10;

export interface TimelineDisplay {
  unit: 'days' | 'weeks';
  min: number;
  max: number;
}

/**
 * How a service's `timelineDays: [min, max]` is shown (D146): in days up to
 * ten days ("3–7 days"), otherwise in whole weeks, rounded ("1–2 weeks"). A
 * week count never drops below one.
 */
export function timelineDisplay([minDays, maxDays]: readonly [number, number]): TimelineDisplay {
  if (maxDays <= MAX_DAYS_SHOWN_AS_DAYS) return { unit: 'days', min: minDays, max: maxDays };
  return {
    unit: 'weeks',
    min: Math.max(1, Math.round(minDays / 7)),
    max: Math.max(1, Math.round(maxDays / 7)),
  };
}
