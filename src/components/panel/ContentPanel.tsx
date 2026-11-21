'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { routeFlightGate } from '@/components/motion/flight-gate';
import { useEnterAnimation } from '@/components/motion/use-enter-animation';
import { usePathname } from '@/i18n/navigation';
import { PanelShell } from './PanelShell';

interface ContentPanelProps {
  /** id of the panel's h1, used as the region's accessible name. */
  labelledBy: string;
  children: ReactNode;
  style?: CSSProperties;
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
 */
export function ContentPanel({ labelledBy, children, style }: ContentPanelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // One gate per mounted panel (a stable reference, see EnterGate).
  const [gate] = useState(() => routeFlightGate(pathname));
  useEnterAnimation(frameRef, { gate });

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

  return (
    <PanelShell
      labelledBy={labelledBy}
      style={style}
      frameRef={frameRef}
      scrollRef={scrollRef}
      contentRef={contentRef}
    >
      {children}
    </PanelShell>
  );
}
