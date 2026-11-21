'use client';

import { useEffect } from 'react';
import { useSceneStore } from '@/store/scene';

/**
 * Mirrors scene state to <html> for automation (D45, D56): e2e tests,
 * screenshots and reviewers, and CSS later if needed.
 * - `data-scene-flight="active"` while a camera flight runs;
 * - `data-scene-focus="<locale-less path>"` once the camera has settled on a
 *   scene state (removed while the scene has not settled anywhere yet).
 * Written only when a value changes, never per frame.
 */
export function FlightStatus() {
  useEffect(() => {
    const root = document.documentElement;
    const applyFlight = (active: boolean) => {
      if (active) root.dataset.sceneFlight = 'active';
      else delete root.dataset.sceneFlight;
    };
    const applyFocus = (focus: string | null) => {
      if (focus === null) delete root.dataset.sceneFocus;
      else root.dataset.sceneFocus = focus;
    };
    const initial = useSceneStore.getState();
    applyFlight(initial.flight.active);
    applyFocus(initial.focus);
    const unsubscribe = useSceneStore.subscribe((next, previous) => {
      if (next.flight.active !== previous.flight.active) applyFlight(next.flight.active);
      if (next.focus !== previous.focus) applyFocus(next.focus);
    });
    return () => {
      unsubscribe();
      delete root.dataset.sceneFlight;
      delete root.dataset.sceneFocus;
    };
  }, []);

  return null;
}
