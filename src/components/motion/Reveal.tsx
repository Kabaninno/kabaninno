'use client';

import { useRef, type ComponentProps } from 'react';
import { useEnterAnimation, type EnterAnimationOptions } from './use-enter-animation';

type RevealProps = ComponentProps<'div'> & EnterAnimationOptions;

/**
 * `<div>` that plays the UI entrance after client-side navigations (never on
 * the initial load). See `useEnterAnimation`.
 */
export function Reveal({ delayMs, reducedDelayMs, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterAnimation(ref, { delayMs, reducedDelayMs });
  return <div ref={ref} {...props} />;
}
