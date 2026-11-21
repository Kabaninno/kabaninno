'use client';

import { useEffect, type ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { useSceneStore } from '@/store/scene';

type HighlightLinkProps = ComponentProps<typeof Link> & {
  /** Scene node id, e.g. "category:web" or "service:web/landing-pages". */
  highlightId: string;
};

function clear(id: string) {
  const store = useSceneStore.getState();
  if (store.highlighted === id) store.setHighlighted(null);
}

/**
 * Locale-aware link that highlights its node in the 3D scene on hover and
 * keyboard focus (and clears it on leave/blur). Reads the store imperatively,
 * so hovering never re-renders the link.
 */
export function HighlightLink({
  highlightId,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: HighlightLinkProps) {
  // Do not leave a stale highlight behind when the link unmounts (route change).
  useEffect(() => () => clear(highlightId), [highlightId]);

  return (
    <Link
      {...props}
      onMouseEnter={(event) => {
        useSceneStore.getState().setHighlighted(highlightId);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        clear(highlightId);
        onMouseLeave?.(event);
      }}
      onFocus={(event) => {
        useSceneStore.getState().setHighlighted(highlightId);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        clear(highlightId);
        onBlur?.(event);
      }}
    />
  );
}
