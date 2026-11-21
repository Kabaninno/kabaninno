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
  /** Mobile sheet collapsed to its peek height (ignored from md up). */
  collapsed?: boolean;
}

/**
 * Markup and styles of the glass content panel, without any behaviour: no
 * hooks, effects or observers. `ContentPanel` adds the entrance animation and
 * the scroll-edge fades on top of it; the error boundary renders it bare, so
 * a failure inside the panel's effects can never re-break its own fallback
 * (QA M1-2 N4).
 *
 * - Desktop (md+): right-side column, 440px wide, below the HUD. It hugs its
 *   content and scrolls inside once it reaches the bottom of the viewport.
 * - Mobile: a bottom sheet docked to the bottom, full width, max 60dvh,
 *   rounded top; `collapsed` shrinks it to a peek (handle, back button, title)
 *   so the planet stays visible. The height change animates (instant under
 *   reduced motion) and reaches the camera via SafeAreaPublisher.
 * - `touch-action: pan-y pinch-zoom`: vertical scrolling and zoom stay
 *   native, horizontal swipes reach the planet-switching handlers.
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
}: PanelShellProps) {
  return (
    <div
      ref={frameRef}
      data-scene-overlay=""
      data-route-ui=""
      data-sheet={collapsed ? 'collapsed' : 'expanded'}
      style={style}
      className={`group/panel pointer-events-auto fixed inset-x-0 bottom-0 z-10 flex touch-pan-y touch-pinch-zoom flex-col overflow-hidden rounded-t-3xl border-b-0 glass-panel shadow-[0_-12px_48px_rgb(0_0_0/0.4)] transition-[max-height] duration-300 ease-calm md:top-[var(--hud-offset)] md:right-3 md:bottom-auto md:left-auto md:max-h-[calc(100dvh-var(--hud-offset)-0.75rem)] md:w-[440px] md:rounded-3xl md:border-b md:shadow-[0_24px_60px_rgb(0_0_0/0.45)] ${collapsed ? 'max-h-[min(12.5rem,45dvh)]' : 'max-h-[60dvh]'}`}
    >
      {handle ?? (
        <div aria-hidden="true" className="flex shrink-0 justify-center pt-2 pb-1 md:hidden">
          <span className="h-1 w-10 rounded-full bg-white/15" />
        </div>
      )}
      <section
        id={scrollId}
        ref={scrollRef}
        aria-labelledby={labelledBy}
        tabIndex={0}
        className="min-h-0 flex-1 scroll-thin overflow-y-auto rounded-[inherit] px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] focus-visible:outline-offset-[-3px] md:px-7 md:pt-7 md:pb-8"
      >
        <div ref={contentRef}>{children}</div>
      </section>
      {/* Top fade (content scrolled away above), starting under the mobile handle. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-4 h-12 bg-gradient-to-b from-[rgb(8_11_22/0.96)] via-[rgb(8_11_22/0.6)] to-transparent opacity-0 transition-opacity duration-200 ease-calm group-data-[scrolled=true]/panel:opacity-100 md:top-0"
      />
      {/* Bottom fade (more content below); not over the title of a collapsed sheet. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[rgb(8_11_22/0.96)] via-[rgb(8_11_22/0.6)] to-transparent opacity-0 transition-opacity duration-200 ease-calm group-data-[more=true]/panel:opacity-100 max-md:group-data-[sheet=collapsed]/panel:hidden"
      />
    </div>
  );
}
