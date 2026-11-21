import type { CSSProperties, ReactNode, Ref } from 'react';

export interface PanelShellProps {
  /** id of the panel's h1, used as the region's accessible name. */
  labelledBy: string;
  children: ReactNode;
  style?: CSSProperties;
  frameRef?: Ref<HTMLDivElement>;
  scrollRef?: Ref<HTMLElement>;
  contentRef?: Ref<HTMLDivElement>;
  /** id of the scrolling region (for the sheet handle's `aria-controls`). */
  scrollId?: string;
  /** Interactive mobile sheet handle; a decorative bar when omitted. */
  handle?: ReactNode;
  /** Mobile sheet collapsed to its peek height (ignored in the side layout). */
  collapsed?: boolean;
  /** Mobile sheet opens tall (~88 % of the height) instead of 60 % (configurator deep link). */
  tall?: boolean;
}

/**
 * Markup and styles of the glass content panel, without any behaviour: no
 * hooks, effects or observers. `ContentPanel` adds the entrance animation and
 * the scroll-edge fades on top of it; the error boundary renders it bare, so
 * a failure inside the panel's effects can never re-break its own fallback
 * (QA M1-2 N4).
 *
 * - Side layout (`side:` = md+, and landscape phones, D40): right-side
 *   column, up to 440px wide, below the HUD. It hugs its content and scrolls
 *   inside once it reaches the bottom of the viewport.
 * - Portrait phones: a bottom sheet docked to the bottom, full width, max
 *   60dvh (`tall`: ~88dvh), rounded top; `collapsed` shrinks it to a peek
 *   (handle, back button, title) so the planet stays visible. The height
 *   change animates (instant under reduced motion) and reaches the camera via
 *   SafeAreaPublisher. The handle sits on an opaque strip above the top
 *   scroll fade, so it keeps its contrast over scrolled content (V5-05).
 * - The scrolling section exposes its paddings as `--panel-px` /
 *   `--panel-pb` (the bottom one applied by the content wrapper), so
 *   full-bleed children (the wizard's sticky footer) can cancel them.
 * - `scroll-padding` keeps focused elements clear of the top scroll fade and
 *   of a sticky footer: a child that sticks to the bottom publishes its
 *   height as `--panel-footer` on the section (`data-panel-scroll`), and
 *   the browser's focus scrolling stops above it (WCAG 2.4.11, A-F3-03).
 * - `touch-action: pan-y pinch-zoom` on the frame AND on the scrolling
 *   section: vertical scrolling and zoom stay native, horizontal swipes reach
 *   the planet-switching handlers. The section needs its own value: it is a
 *   scroll container, and the browser only looks at elements up to the
 *   nearest one, so the frame's value alone let Chrome take horizontal
 *   gestures over (pointercancel, no swipe; found by the M3 e2e in F2).
 * - Marked as a scene overlay, so the camera frames the scene beside it, and
 *   as route UI, so it fades out when the route changes (`RouteExit`).
 * - Scroll-edge fades follow `data-scrolled` / `data-more` on the frame; they
 *   stay hidden while nobody sets them.
 *
 * The scrolling element is the labelled, focusable `<section>`, so keyboard
 * users can scroll it even when it has no links. The frame opts back into
 * pointer events; the rest of <main> lets the canvas get input.
 */
export function PanelShell({
  labelledBy,
  children,
  style,
  frameRef,
  scrollRef,
  contentRef,
  scrollId,
  handle,
  collapsed = false,
  tall = false,
}: PanelShellProps) {
  const sheetHeight = collapsed
    ? 'max-h-[min(12.5rem,45dvh)]'
    : tall
      ? 'max-h-[min(88dvh,calc(100dvh-var(--hud-offset)))]'
      : 'max-h-[60dvh]';
  return (
    <div
      ref={frameRef}
      data-scene-overlay=""
      data-route-ui=""
      data-sheet={collapsed ? 'collapsed' : 'expanded'}
      style={style}
      className={`group/panel pointer-events-auto fixed inset-x-0 bottom-0 z-10 flex touch-pan-y touch-pinch-zoom flex-col overflow-hidden rounded-t-3xl border-b-0 glass-panel shadow-[0_-12px_48px_rgb(0_0_0/0.4)] transition-[max-height] duration-300 ease-calm ${sheetHeight} side:top-[var(--hud-offset)] side:right-[max(0.75rem,env(safe-area-inset-right))] side:bottom-auto side:left-auto side:max-h-[calc(100dvh-var(--hud-offset)-0.75rem)] side:w-[min(440px,58vw)] side:rounded-3xl side:border-b side:shadow-[0_24px_60px_rgb(0_0_0/0.45)]`}
    >
      {handle ?? (
        <div
          aria-hidden="true"
          className="relative z-[2] flex shrink-0 justify-center bg-[rgb(8_11_22/0.97)] pt-2 pb-1 side:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-white/15" />
        </div>
      )}
      <section
        id={scrollId}
        ref={scrollRef}
        aria-labelledby={labelledBy}
        tabIndex={0}
        data-panel-scroll=""
        className="min-h-0 flex-1 touch-pan-y touch-pinch-zoom scroll-pt-16 scroll-pb-[calc(var(--panel-footer,0px)+0.5rem)] scroll-thin overflow-y-auto rounded-[inherit] px-[var(--panel-px)] pt-3 [--panel-pb:max(1.5rem,env(safe-area-inset-bottom))] [--panel-px:1.25rem] focus-visible:outline-offset-[-3px] side:scroll-pt-12 side:pt-7 side:[--panel-pb:2rem] side:[--panel-px:1.75rem] short:side:pt-4 short:side:[--panel-pb:1.25rem] short:side:[--panel-px:1.25rem]"
      >
        {/*
          The bottom padding lives on the content, not on the scroller: sticky
          children (the wizard footer) then stick flush to the visible bottom
          edge (Chrome insets sticky by the scroller's padding: F2 saw a 24 px
          gap under the footer).
        */}
        <div ref={contentRef} className="pb-[var(--panel-pb)]">
          {children}
        </div>
      </section>
      {/* Top fade (content scrolled away above), starting under the mobile handle strip. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-10 h-16 bg-gradient-to-b from-[rgb(8_11_22/0.96)] via-[rgb(8_11_22/0.6)] to-transparent opacity-0 transition-opacity duration-200 ease-calm group-data-[scrolled=true]/panel:opacity-100 side:top-0 side:h-12"
      />
      {/* Bottom fade (more content below); not over the title of a collapsed sheet. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[rgb(8_11_22/0.96)] via-[rgb(8_11_22/0.6)] to-transparent opacity-0 transition-opacity duration-200 ease-calm group-data-[more=true]/panel:opacity-100 group-data-[sheet=collapsed]/panel:hidden side:group-data-[sheet=collapsed]/panel:block"
      />
    </div>
  );
}
