'use client';

import { useEffect, useRef, useState } from 'react';
import { ENTER_CLASS } from '@/components/motion/use-enter-animation';
import { analytics } from '@/lib/analytics';
import { INTRO_ACTIVE_ATTRIBUTE, INTRO_MAX_MS, keySkipsIntro } from '@/lib/intro';
import { prefersReducedMotion } from '@/lib/motion';
import { useSceneStore } from '@/store/scene';
import { focusHeading, pageHeading } from './RouteFocus';

/** Elements held back while the intro plays (the home hero frame). */
const HIDDEN_SELECTOR = '[data-intro-hide]';

/**
 * Ends the intro's hold on the page: drops `html[data-intro-active]` and lets
 * the hero come back with the art-direction entrance (a plain cut under
 * reduced motion, where no intro plays anyway). Idempotent.
 */
function releaseHeldUi(): void {
  const root = document.documentElement;
  if (!root.hasAttribute(INTRO_ACTIVE_ATTRIBUTE)) return;
  root.removeAttribute(INTRO_ACTIVE_ATTRIBUTE);
  if (prefersReducedMotion()) return;
  for (const element of document.querySelectorAll<HTMLElement>(HIDDEN_SELECTOR)) {
    const done = (event: AnimationEvent) => {
      if (event.target !== element) return;
      element.classList.remove(ENTER_CLASS);
      element.removeEventListener('animationend', done);
    };
    element.addEventListener('animationend', done);
    element.classList.add(ENTER_CLASS);
  }
}

/**
 * First-visit intro controls (BRIEF: ≤ 3 s, skippable; D94). While the scene
 * reports `introActive`:
 * - the home hero steps aside (`html[data-intro-active]` fades
 *   `[data-intro-hide]` out; the HUD stays), and comes back with the UI
 *   entrance when the intro ends. The hero was painted before the scene
 *   loaded, so LCP is not affected;
 * - a "Skip intro" button is shown; any key (Esc included) or pointer press
 *   skips as well (`skipIntro`, the scene jumps to the end);
 * A safety cap releases the page if the scene never reports the end. Focus
 * on the skip button moves to the page heading when the button goes away.
 */
export function IntroControl({ label }: { label: string }) {
  const active = useSceneStore((state) => state.introActive);
  const [capped, setCapped] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const skipped = useRef(false);

  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute(INTRO_ACTIVE_ATTRIBUTE, '');

    const finish = () => {
      const hadFocus = buttonRef.current !== null && document.activeElement === buttonRef.current;
      releaseHeldUi();
      if (hadFocus) {
        const heading = pageHeading();
        if (heading) focusHeading(heading);
      }
    };
    const skip = (via: string) => {
      if (skipped.current) return;
      skipped.current = true;
      useSceneStore.getState().skipIntro();
      analytics.track('intro_skip', { via });
      finish();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!keySkipsIntro(event.key)) return;
      // Esc only skips here; it must not also navigate (EscapeToParent).
      if (event.key === 'Escape') event.preventDefault();
      skip('key');
    };
    const onPointer = () => skip('pointer');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    // Scrolling (wheel, touch drag) ends it as well.
    window.addEventListener('wheel', onPointer, { capture: true, passive: true });
    window.addEventListener('touchmove', onPointer, { capture: true, passive: true });
    const cap = window.setTimeout(() => {
      finish();
      setCapped(true);
    }, INTRO_MAX_MS);

    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('wheel', onPointer, true);
      window.removeEventListener('touchmove', onPointer, true);
      window.clearTimeout(cap);
      // The scene reported the end (or skipped to it), or this unmounted.
      finish();
    };
  }, [active]);

  if (!active || capped) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      data-intro-skip=""
      // Keyboard activation; a pointer press already skipped in the capture listener.
      onClick={() => {
        if (skipped.current) return;
        skipped.current = true;
        useSceneStore.getState().skipIntro();
        analytics.track('intro_skip', { via: 'button' });
      }}
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 inline-flex min-h-11 items-center gap-2.5 rounded-full glass px-4 text-[0.8125rem] text-ink transition-[opacity,background-color] duration-300 ease-calm hover:bg-[rgb(10_14_28/0.8)] active:bg-[rgb(10_14_28/0.9)] md:right-auto md:bottom-10 md:left-1/2 md:-translate-x-1/2 starting:opacity-0"
    >
      {label}
      <kbd
        aria-hidden="true"
        className="rounded-md border border-white/15 px-1.5 py-0.5 font-mono text-[0.625rem] tracking-[0.1em] text-muted"
      >
        ESC
      </kbd>
    </button>
  );
}
