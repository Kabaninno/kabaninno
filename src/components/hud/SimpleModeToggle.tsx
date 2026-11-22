'use client';

import { useTranslations } from 'next-intl';
import { useId, useSyncExternalStore } from 'react';
import { analytics } from '@/lib/analytics';
import { writeSimplePreference } from '@/lib/simple-mode';
import { isWebGLAvailable } from '@/lib/webgl';
import { useSceneStore } from '@/store/scene';
import { useUiStore } from '@/store/ui';

const subscribeNever = () => () => {};

interface SimpleModeToggleProps {
  /** `compact`: "2D" + switch in the HUD bar; `row`: full-width row in the mobile menu. */
  variant?: 'compact' | 'row';
  className?: string;
}

/**
 * Switch for simple (2D) mode (D94): an APG switch (`role="switch"`,
 * `aria-checked`) that stores the choice and updates the scene store;
 * SceneRoot unmounts or mounts the 3D layer, BootState mirrors the change to
 * `html[data-simple]`. When 3D cannot run (no WebGL 2 API, or this browser
 * failed to create a context: `webglUnavailable`, A-F3-04) simple mode is
 * forced: the switch stays on and says why (`aria-disabled`, still
 * focusable), so it can never leave an empty sky behind.
 *
 * The track and knob are styled from `html[data-simple]` (globals.css), not
 * from React state, so they are right from the first paint (the inline boot
 * script sets the attribute) — hydration still starts from the store's
 * initial value.
 */
export function SimpleModeToggle({ variant = 'compact', className = '' }: SimpleModeToggleProps) {
  const t = useTranslations('hud');
  const simple = useSceneStore((state) => state.simpleMode === true);
  // null while hydrating (no mismatch), then the real API check.
  const webgl = useSyncExternalStore(subscribeNever, isWebGLAvailable, () => null);
  const unavailable = useUiStore((state) => state.webglUnavailable);
  const forced = webgl === false || unavailable;
  const hintId = useId();

  const toggle = () => {
    if (forced) return;
    const next = !simple;
    writeSimplePreference(next);
    // Not forced here, so the explicit choice decides (resolveSimpleMode).
    useSceneStore.getState().setSimpleMode(next);
    analytics.track('simple_mode', { on: next });
  };

  const track = (
    <span aria-hidden="true" className="simple-switch">
      <span className="simple-switch-knob" />
    </span>
  );
  const hint = forced ? (
    <span id={hintId} className="sr-only">
      {t('simpleModeForced')}
    </span>
  ) : null;

  if (variant === 'row') {
    return (
      <>
        <button
          type="button"
          role="switch"
          aria-checked={simple}
          aria-disabled={forced || undefined}
          aria-describedby={forced ? hintId : undefined}
          onClick={toggle}
          className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-base text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-disabled:cursor-not-allowed ${className}`}
        >
          <span>{t('simpleMode')}</span>
          {track}
        </button>
        {hint}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={simple}
        aria-disabled={forced || undefined}
        aria-describedby={forced ? hintId : undefined}
        aria-label={t('simpleMode')}
        title={forced ? t('simpleModeForced') : t('simpleMode')}
        onClick={toggle}
        className={`inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-muted transition-colors duration-150 ease-calm hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-disabled:cursor-not-allowed pointer-coarse:h-11 ${className}`}
      >
        <span aria-hidden="true" className="font-mono text-label font-medium tracking-[0.12em]">
          2D
        </span>
        {track}
      </button>
      {hint}
    </>
  );
}
