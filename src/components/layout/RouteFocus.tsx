'use client';

import { useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';
import { withBasePath } from '@/lib/base-path';
import { routeFocusPlan } from '@/lib/route-focus';

/** The page's main heading (panels and the home hero). */
export function pageHeading(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main [data-route-ui] h1, main h1');
}

/**
 * Focuses a heading without scrolling. Headings are not focusable, so they
 * get `tabindex="-1"` (the global CSS hides the ring unless `:focus-visible`,
 * i.e. after keyboard input).
 */
export function focusHeading(heading: HTMLElement): void {
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

function isRendered(element: Element): boolean {
  return element.getClientRects().length > 0;
}

/**
 * Focus management on client-side route changes (a11y A-01, logic in
 * `lib/route-focus.ts`): the activated link usually unmounts with the old
 * route, so without this focus would fall back to <body>. Going up with the
 * keyboard returns focus to the link leading back down (the home index node
 * just left, the planet in its system panel); other changes focus the new
 * page's heading. Next's route announcer still announces the new title.
 *
 * Tracks the last input modality (key vs pointer) in capture listeners.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const locale = useLocale();
  const previous = useRef(pathname);
  const keyboard = useRef(false);

  useEffect(() => {
    const onKey = () => {
      keyboard.current = true;
    };
    const onPointer = () => {
      keyboard.current = false;
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname) return;
    // Focus that survived the change (a HUD link, the menu button) stays.
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected && isRendered(active)) return;

    const plan = routeFocusPlan(from, pathname, keyboard.current);
    let next = plan.type === 'heading' ? 'heading' : 'none';
    if (plan.type === 'link') {
      for (const path of plan.paths) {
        const href = withBasePath(`/${locale}${path}`);
        const link = Array.from(
          document.querySelectorAll<HTMLAnchorElement>(
            `main nav a[href="${href}"], main a[href="${href}"]`,
          ),
        ).find(isRendered);
        if (link) {
          link.focus({ preventScroll: true });
          return;
        }
      }
      next = plan.fallback;
    }
    if (next === 'heading') {
      const heading = pageHeading();
      if (heading) focusHeading(heading);
    }
  }, [pathname, locale]);

  return null;
}
