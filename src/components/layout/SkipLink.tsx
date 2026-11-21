'use client';

import type { MouseEvent } from 'react';
import { focusHeading, pageHeading } from './RouteFocus';

/**
 * "Skip to content". Without JavaScript it jumps to `main#main`. With it, focus
 * goes to the page's heading instead (a11y A-02): <main> only holds fixed and
 * absolutely positioned overlays, so it is 0 px tall and a focus ring on it
 * would be invisible; the heading has a real box and the next Tab continues
 * inside the content.
 */
export function SkipLink({ label }: { label: string }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const heading = pageHeading();
    if (!heading) return;
    event.preventDefault();
    focusHeading(heading);
  };

  return (
    <a
      href="#main"
      onClick={onClick}
      className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full glass px-5 py-3 text-sm text-ink transition-transform duration-200 focus-visible:translate-y-0"
    >
      {label}
    </a>
  );
}
