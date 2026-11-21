'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { routeFlightGate } from '@/components/motion/flight-gate';
import { useEnterAnimation } from '@/components/motion/use-enter-animation';
import { usePathname } from '@/i18n/navigation';
import { useUiStore } from '@/store/ui';
import { PanelShell } from './PanelShell';
import { SheetHandle } from './SheetHandle';
import { usePanelSiblings, type PanelSiblings } from './use-panel-siblings';

interface ContentPanelProps {
  /** id of the panel's h1, used as the region's accessible name. */
  labelledBy: string;
  children: ReactNode;
  style?: CSSProperties;
  /**
   * Neighbouring planets on system and planet routes: ←/→ keys and a
   * horizontal swipe switch to them with `router.replace` (D16).
   */
  siblings?: PanelSiblings;
}

/** Scroll distance (px) below which an edge counts as reached. */
const EDGE_TOLERANCE = 4;

/**
 * Glass content panel over the scene (layout and styles: `PanelShell`).
 * - Enters with the art-direction motion on client-side navigations, once
 *   the camera flight to its route has covered 35 % (visual V2-06: at the
 *   start of the flight the target node is still where the panel will be).
 *   Same fallbacks as the home hero (D44); none of it on the first load or
 *   under reduced motion.
 * - Soft fades at the top and bottom edges signal content scrolled away above
 *   and more content below. The state lives in `data-scrolled` / `data-more`
 *   attributes on the frame: no React re-renders while scrolling.
 * - Mobile: an interactive sheet handle collapses / expands the bottom sheet
 *   (`SheetHandle`); keyboard focus moving into a collapsed sheet expands it,
 *   so the focused element is never hidden. Programmatic focus after a touch
 *   navigation (not `:focus-visible`) leaves a collapsed sheet collapsed.
 * - `siblings`: planet switching by keys and swipe (`usePanelSiblings`).
 */
export function ContentPanel({ labelledBy, children, style, siblings }: ContentPanelProps) {
  const t = useTranslations('panel');
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollId = useId();
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sheetCollapsed);
  // One gate per mounted panel (a stable reference, see EnterGate).
  const [gate] = useState(() => routeFlightGate(pathname));
  useEnterAnimation(frameRef, { gate });
  usePanelSiblings(frameRef, siblings);

  useEffect(() => {
    const frame = frameRef.current;
    const scroller = scrollRef.current;
    if (!frame || !scroller) return;
    const update = () => {
      const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      const more = remaining > EDGE_TOLERANCE ? 'true' : 'false';
      const scrolled = scroller.scrollTop > EDGE_TOLERANCE ? 'true' : 'false';
      if (frame.dataset.more !== more) frame.dataset.more = more;
      if (frame.dataset.scrolled !== scrolled) frame.dataset.scrolled = scrolled;
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(scroller);
    if (contentRef.current) resizeObserver.observe(contentRef.current);
    return () => {
      scroller.removeEventListener('scroll', update);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.matches(':focus-visible')) return;
      const ui = useUiStore.getState();
      if (ui.sheetCollapsed) ui.setSheetCollapsed(false);
    };
    scroller.addEventListener('focusin', onFocusIn);
    return () => scroller.removeEventListener('focusin', onFocusIn);
  }, []);

  return (
    <PanelShell
      labelledBy={labelledBy}
      style={style}
      frameRef={frameRef}
      scrollRef={scrollRef}
      contentRef={contentRef}
      scrollId={scrollId}
      collapsed={collapsed}
      handle={<SheetHandle label={t('sheetToggle')} controls={scrollId} />}
    >
      {children}
    </PanelShell>
  );
}
