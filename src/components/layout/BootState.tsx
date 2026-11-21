'use client';

import { useEffect } from 'react';
import { isIntroEligible, isIntroOptedOut, isLocaleHomePath } from '@/lib/intro';
import { prefersReducedMotion } from '@/lib/motion';
import {
  applySimpleAttribute,
  currentSimpleModeInputs,
  markWebglFailed,
  readSimplePreference,
  resolveSimpleMode,
} from '@/lib/simple-mode';
import { isWebGLAvailable } from '@/lib/webgl';
import { useSceneStore } from '@/store/scene';
import { useUiStore } from '@/store/ui';

/**
 * Seeds the per-load UI decisions into the scene store (D94) as soon as this
 * module is evaluated in the browser — before React renders the layout, so
 * SceneRoot never mounts the 3D layer only to drop it again:
 * - `simpleMode`: the same rule as the inline boot script in `<head>`
 *   (`resolveSimpleMode`: forced without WebGL, else the stored choice, else
 *   low-end hints, D115); re-applied here in case the inline script could
 *   not run. A stored "WebGL failed here" marker also marks the UI store as
 *   `webglUnavailable` (switch disabled);
 * - `introEligible`: freshly loaded on a locale home (not opted out), no
 *   reduced motion, not in simple mode (D140).
 * Components still hydrate with the store's initial values (zustand's server
 * snapshot), so the server HTML and the first client render agree.
 */
function seedFromDocument(): void {
  const inputs = currentSimpleModeInputs();
  const simple = resolveSimpleMode(inputs);
  if (inputs.webglFailed) useUiStore.getState().setWebglUnavailable(true);
  applySimpleAttribute(simple);
  const store = useSceneStore.getState();
  store.setSimpleMode(simple);
  store.setIntroEligible(
    isIntroEligible({
      home: isLocaleHomePath(window.location.pathname),
      optedOut: isIntroOptedOut(),
      reducedMotion: prefersReducedMotion(),
      simple,
    }),
  );
}

if (typeof window !== 'undefined') seedFromDocument();

/**
 * Keeps `html[data-simple]` in sync with the store from then on (the HUD
 * switch, or the scene giving up), so the CSS backdrop follows every change.
 *
 * Only two writers turn simple mode on at runtime: the HUD switch, which
 * stores the choice first, and the scene when it cannot create a WebGL
 * context although the API exists (D55). So "on, without a stored on, with
 * the API" means the scene gave up: the UI then treats simple mode as forced
 * (`webglUnavailable`) and stores the failure marker, so the next page load
 * decides before the first paint and skips the scene download (A-F3-04).
 */
export function BootState() {
  useEffect(
    () =>
      useSceneStore.subscribe((state, previous) => {
        if (state.simpleMode === previous.simpleMode || state.simpleMode === null) return;
        applySimpleAttribute(state.simpleMode);
        if (state.simpleMode && readSimplePreference() !== true && isWebGLAvailable()) {
          useUiStore.getState().setWebglUnavailable(true);
          markWebglFailed();
        }
      }),
    [],
  );
  return null;
}
