'use client';

import { useEffect, useState } from 'react';
import { useSceneStore } from '@/store/scene';
import { useUiStore } from '@/store/ui';

/** No boot step for this long: the scene stalled or gave up, stop showing progress. */
const STALL_MS = 20_000;

/**
 * Scene loading indicator (BRIEF «екран завантаження з прогресом», D94): a
 * hairline along the bottom edge of the HUD bar that fills with
 * `bootProgress` and fades out at 1. It never covers content — the HTML is
 * usable before the 3D layer arrives — and is decorative (`aria-hidden`), so
 * screen readers are not told about a visual-only layer.
 *
 * Hidden in simple mode, when WebGL is unavailable, before the UI has
 * decided the mode (server HTML, hydration), and after a long stall (the
 * scene chunk failed to load).
 */
export function BootIndicator() {
  const progress = useSceneStore((state) => state.bootProgress);
  const simple = useSceneStore((state) => state.simpleMode);
  const unavailable = useUiStore((state) => state.webglUnavailable);
  const [stalledAt, setStalledAt] = useState<number | null>(null);
  const loading = simple === false && !unavailable && progress < 1;

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setStalledAt(progress), STALL_MS);
    return () => window.clearTimeout(timer);
  }, [loading, progress]);

  const visible = loading && stalledAt !== progress;

  return (
    <span
      aria-hidden="true"
      data-boot-progress={Math.round(progress * 100)}
      className={`pointer-events-none absolute inset-x-5 bottom-0 h-px overflow-hidden rounded-full bg-white/[0.06] transition-opacity duration-500 ease-calm ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <span
        className="block h-full origin-left bg-[linear-gradient(90deg,transparent,var(--color-brand))] transition-transform duration-500 ease-calm"
        style={{ transform: `scaleX(${Math.max(0.06, progress)})` }}
      />
    </span>
  );
}
