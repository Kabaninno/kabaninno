'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { isSceneTarget, swallowGestureClick } from '@/lib/dom';
import { ariaCurrentFor } from '@/lib/nav';
import { paths } from '@/lib/routes';
import { accentStyle, formatIndex } from '@/lib/style';
import { hudLink } from '@/components/ui/styles';
import { sceneNodeId } from '@/scene/node-ids';
import type { NavCategory } from '@/lib/nav';
import { useHudLocation } from './use-hud-section';

/**
 * Desktop "Services" disclosure. Open state is keyed by the pathname it was
 * opened on, so any route change closes it without an effect. Hovering or
 * focusing a category highlights its node in the scene.
 */
export function ServicesMenu({ categories }: { categories: readonly NavCategory[] }) {
  const t = useTranslations('hud');
  const { pathname, section } = useHudLocation();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenOn(null);
      // Dismissing the menu over the scene must not also activate a 3D node.
      if (isSceneTarget(event.target)) swallowGestureClick();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Consumed here: scene-level Esc handlers must check `defaultPrevented`.
      event.preventDefault();
      const focusWasInside = rootRef.current?.contains(document.activeElement) ?? false;
      setOpenOn(null);
      if (focusWasInside) buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && !event.currentTarget.contains(next)) setOpenOn(null);
  };

  return (
    <div ref={rootRef} className="relative" onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpenOn(open ? null : pathname)}
        className={`${hudLink} ${section === 'services' ? 'text-ink' : ''}`}
      >
        {section === 'services' ? (
          <span aria-hidden="true" className="size-1 rounded-full bg-ink" />
        ) : null}
        {t('services')}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`size-3 transition-transform duration-200 ease-calm ${open ? 'rotate-180' : ''}`}
        >
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="absolute top-full left-0 mt-3 w-72 rounded-2xl glass-panel p-2 shadow-[0_24px_60px_rgb(0_0_0/0.45)] transition-[opacity,translate] duration-250 ease-calm starting:-translate-y-2 starting:opacity-0"
      >
        <ul className="flex flex-col">
          {categories.map((category) => {
            const href = paths.category(category.id);
            return (
              <li key={category.id}>
                <HighlightLink
                  href={href}
                  highlightId={sceneNodeId.category(category.id)}
                  aria-current={ariaCurrentFor(pathname, href)}
                  onClick={() => setOpenOn(null)}
                  style={accentStyle(category.color)}
                  className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/10 aria-[current]:text-ink"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] transition-transform duration-150 group-hover:scale-125"
                  />
                  <span aria-hidden="true" className="mono-index text-faint">
                    {formatIndex(category.index)}
                  </span>
                  <span>{category.name}</span>
                </HighlightLink>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
