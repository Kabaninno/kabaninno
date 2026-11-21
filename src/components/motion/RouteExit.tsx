'use client';

import { useEffect } from 'react';
import { prefersReducedMotion, UI_MOTION } from '@/lib/motion';
import { ENTER_CLASS, ENTER_PENDING_CLASS } from './use-enter-animation';

/** Marks the root element of a route's overlay UI (home hero frame, content panel). */
export const ROUTE_UI_ATTRIBUTE = 'data-route-ui';

const MAIN_ID = 'main';
/** Attributes that must not survive on a ghost: ids (duplicates), overlay markers (safeRect). */
const STRIPPED_ATTRIBUTES = ['id', 'data-scene-overlay', ROUTE_UI_ATTRIBUTE];

/**
 * Lets the outgoing route UI fade out (~150 ms) instead of vanishing on
 * client-side navigations (visual N-03): links, router calls, Esc and
 * Back/Forward alike.
 *
 * How: a MutationObserver on <main> sees React remove the old route's root
 * (`[data-route-ui]`). Mutation callbacks run as a microtask after React's
 * commit and before the browser paints, so the removed node is re-attached
 * at once to a fixed, `inert`, `aria-hidden` layer above the new route that
 * fades out and removes itself. The ghost is a dead copy: React has already
 * forgotten the node, it cannot take focus or pointer events, it is hidden
 * from assistive technology, and its ids and `data-scene-overlay` markers are
 * stripped (no duplicate ids, no influence on the camera's safe rect).
 *
 * Nothing changes for the new route: its own entrance, focus handling and the
 * router are untouched. Skipped under reduced motion, in hidden tabs and for
 * roots that never became fully visible (still waiting for or playing their
 * entrance), which would otherwise flash.
 */
export function RouteExit() {
  useEffect(() => {
    const main = document.getElementById(MAIN_ID);
    if (!main) return;

    // Scroll positions die with the layout box when a node is detached;
    // remember them so a scrolled panel fades out where it was.
    const scrollTops = new WeakMap<Element, number>();
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && main.contains(target)) {
        scrollTops.set(target, target.scrollTop);
      }
    };

    const ghosts = new Set<HTMLElement>();
    const spawn = (node: HTMLElement) => {
      const elements = [node, ...Array.from(node.querySelectorAll<HTMLElement>('*'))];
      for (const element of elements) {
        for (const name of STRIPPED_ATTRIBUTES) element.removeAttribute(name);
      }
      const layer = document.createElement('div');
      layer.className = 'ui-exit-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      layer.append(node);
      document.body.append(layer);
      ghosts.add(layer);
      for (const element of elements) {
        const top = scrollTops.get(element);
        if (top) element.scrollTop = top;
      }
      const remove = () => {
        window.clearTimeout(fallback);
        layer.remove();
        ghosts.delete(layer);
      };
      // `animationend` normally; the timer covers throttled/hidden documents.
      const fallback = window.setTimeout(remove, UI_MOTION.exitFadeMs + 250);
      layer.addEventListener('animationend', remove, { once: true });
    };

    const observer = new MutationObserver((records) => {
      if (prefersReducedMotion() || document.visibilityState === 'hidden') return;
      for (const record of records) {
        for (const node of Array.from(record.removedNodes)) {
          if (!(node instanceof HTMLElement) || node.isConnected) continue;
          if (!node.hasAttribute(ROUTE_UI_ATTRIBUTE)) continue;
          if (node.classList.contains(ENTER_PENDING_CLASS)) continue;
          if (node.classList.contains(ENTER_CLASS)) continue;
          spawn(node);
        }
      }
    });

    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', onScroll, { capture: true });
      for (const layer of ghosts) layer.remove();
      ghosts.clear();
    };
  }, []);

  return null;
}
