'use client';

import { useEffect } from 'react';
import { hasSeenIntro, isIntroEligible, isLocaleHomePath } from '@/lib/intro';
import { prefersReducedMotion } from '@/lib/motion';
import { applySimpleAttribute, currentSimpleMode } from '@/lib/simple-mode';
import { useSceneStore } from '@/store/scene';

/**
 * Seeds the per-load UI decisions into the scene store (D94) as soon as this
 * module is evaluated in the browser — before React renders the layout, so
 * SceneRoot never mounts the 3D layer only to drop it again:
 * - `simpleMode`: the same rule as the inline boot script in `<head>`
 *   (stored choice, else forced without the WebGL 2 API); re-applied here in
 *   case the inline script could not run;
 * - `introEligible`: loaded on a locale home, first visit, no reduced motion,
 *   not in simple mode.
 * Components still hydrate with the store's initial values (zustand's server
 * snapshot), so the server HTML and the first client render agree.
 */
function seedFromDocument(): void {
  const simple = currentSimpleMode();
  applySimpleAttribute(simple);
  const store = useSceneStore.getState();
  store.setSimpleMode(simple);
  store.setIntroEligible(
    isIntroEligible({
      home: isLocaleHomePath(window.location.pathname),
      seen: hasSeenIntro(),
      reducedMotion: prefersReducedMotion(),
      simple,
    }),
  );
}

if (typeof window !== 'undefined') seedFromDocument();

/**
 * Keeps `html[data-simple]` in sync with the store from then on (the HUD
 * switch, or the scene giving up), so the CSS backdrop follows every change.
 */
export function BootState() {
  useEffect(
    () =>
      useSceneStore.subscribe((state, previous) => {
        if (state.simpleMode !== previous.simpleMode && state.simpleMode !== null) {
          applySimpleAttribute(state.simpleMode);
        }
      }),
    [],
  );
  return null;
}
