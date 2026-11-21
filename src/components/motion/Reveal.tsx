'use client';

import { useRef, type ComponentProps } from 'react';
import { universeFlightGate } from './flight-gate';
import { useEnterAnimation, type EnterAnimationOptions } from './use-enter-animation';

/** Named gates (server components can only pass serializable props). */
const GATES = {
  'universe-flight': universeFlightGate,
} as const;

type RevealProps = ComponentProps<'div'> &
  Omit<EnterAnimationOptions, 'gate'> & {
    /** Wait for a scene signal before entering (see `flight-gate.ts`). */
    gate?: keyof typeof GATES;
  };

/**
 * `<div>` that plays the UI entrance after client-side navigations (never on
 * the initial load). See `useEnterAnimation`.
 */
export function Reveal({ delayMs, reducedDelayMs, gate, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterAnimation(ref, { delayMs, reducedDelayMs, gate: gate ? GATES[gate] : undefined });
  return <div ref={ref} {...props} />;
}
