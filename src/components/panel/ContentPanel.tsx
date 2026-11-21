'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useEnterAnimation } from '@/components/motion/use-enter-animation';
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
 * - Enters with the art-direction motion on client-side navigations.
 * - Soft fades at the top and bottom edges signal content scrolled away above
 *   and more content below. The state lives in `data-scrolled` / `data-more`
 *   attributes on the frame: no React re-renders while scrolling.
 */
export function ContentPanel({ labelledBy, children, style }: ContentPanelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEnterAnimation(frameRef);

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
