'use client';

import { useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { stripBasePath } from '@/lib/base-path';
import { escapeAction, isEditableElement, shouldHandleEscape } from '@/lib/escape-nav';

/** The slice of the Navigation API used here (not in every TS DOM lib yet). */
interface NavigationLike {
  currentEntry: { index: number } | null;
  entries: () => ReadonlyArray<{ url: string | null }>;
}

/**
 * Pathname (base path stripped) of the previous session-history entry, or
 * null when unknown. Uses the Navigation API where available (Chromium,
 * Safari 26+, Firefox 147+); without it Esc always pushes the parent path,
 * which is never wrong, only one history entry longer.
 */
function previousEntryPath(): string | null {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  const index = navigation?.currentEntry?.index ?? -1;
  if (!navigation || index <= 0 || typeof navigation.entries !== 'function') return null;
  const url = navigation.entries()[index - 1]?.url;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== window.location.origin) return null;
    return stripBasePath(parsed.pathname);
  } catch {
    return null;
  }
}

function isDialogOpen(): boolean {
  return document.querySelector('dialog[open], [aria-modal="true"]') !== null;
}

/**
 * Global "Esc → back" (D27, PLAN §2.9): planet → system → universe, project →
 * portfolio, portfolio/configurator → universe. Goes back in history when
 * the previous entry is the parent, otherwise pushes the parent path (see
 * `escapeAction`). Listens on `window` in the bubble phase, so element and
 * document handlers run first and can consume the key with `preventDefault()`
 * (the Services menu does). Text fields, open dialogs, auto-repeat and
 * modified keys are ignored (`shouldHandleEscape`).
 */
export function EscapeToParent() {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const current = useRef({ pathname, locale, router });

  useEffect(() => {
    current.current = { pathname, locale, router };
  }, [pathname, locale, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const active = document.activeElement;
      const editableTarget =
        isEditableElement(target as HTMLElement | null) ||
        isEditableElement(active as HTMLElement | null);
      if (!shouldHandleEscape(event, { editableTarget, dialogOpen: isDialogOpen() })) return;

      const { pathname: path, locale: lang, router: nav } = current.current;
      const action = escapeAction(path, lang, previousEntryPath());
      if (action.type === 'none') return;
      event.preventDefault();
      if (action.type === 'back') nav.back();
      else nav.push(action.path);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
