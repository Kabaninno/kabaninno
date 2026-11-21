'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState, useSyncExternalStore, type ComponentType } from 'react';
import { isWebGLAvailable } from '@/lib/webgl';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import type { SceneManifest } from './types';

interface ExperienceProps {
  manifest: SceneManifest;
  /** The WebGL context could not be created: continue without the scene, silently. */
  onUnavailable: () => void;
}

/** Stand-in when the scene bundle cannot be loaded: the page works without 3D. */
const NoScene: ComponentType<ExperienceProps> = () => null;

/*
 * The 3D bundle (three.js, R3F) is client-only and loaded after the HTML. A
 * failed chunk (flaky mobile network, content blocker, stale HTML after a
 * redeploy) must never take the page down: continue without the scene.
 * No retry here: Turbopack's chunk loader already retries a network failure
 * once and then caches the rejection for the module, so a second `import()`
 * could not succeed anyway.
 */
const Experience = dynamic<ExperienceProps>(
  () =>
    import('./Experience').catch(() => {
      console.warn('[scene] The 3D layer could not be loaded; continuing without it.');
      return { default: NoScene };
    }),
  { ssr: false, loading: () => null },
);

const subscribe = () => () => {};

/**
 * Persistent 3D layer (contract used by `src/app/[locale]/layout.tsx`).
 * Lives in the locale layout, so it is never remounted when navigating
 * between routes. Server HTML renders without it. Load and render failures
 * stay inside this layer (see SceneErrorBoundary).
 */
export function SceneRoot({ manifest }: { manifest: SceneManifest }) {
  // null on the server / first hydration pass, boolean afterwards. A cheap API
  // check (no probe context, perf P-01); the real context may still fail.
  const webgl = useSyncExternalStore(subscribe, isWebGLAvailable, () => null);
  const [unavailable, setUnavailable] = useState(false);
  const handleUnavailable = useCallback(() => setUnavailable(true), []);

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true" data-scene-root="">
      {webgl && !unavailable ? (
        <SceneErrorBoundary>
          <Experience manifest={manifest} onUnavailable={handleUnavailable} />
        </SceneErrorBoundary>
      ) : null}
    </div>
  );
}
