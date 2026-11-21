'use client';

import { useEffect, useRef, type ComponentProps } from 'react';
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
 *
 * The other way round, it carries `data-highlighted` while its id is the
 * highlighted one, whoever set it (another link to the same node, the 2D map
 * of simple mode, a 3D hover): lists style it like hover (D124). Set on the
 * DOM from a store subscription, again without re-rendering.
 */
export function HighlightLink({
  highlightId,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: HighlightLinkProps) {
  const ownRef = useRef<HTMLAnchorElement>(null);

  // Do not leave a stale highlight behind when the link unmounts (route change).
  useEffect(() => () => clear(highlightId), [highlightId]);

  useEffect(() => {
    const apply = (id: string | null) => {
      const element = ownRef.current;
      if (!element) return;
      if (id === highlightId) element.setAttribute('data-highlighted', '');
      else element.removeAttribute('data-highlighted');
    };
    apply(useSceneStore.getState().highlighted);
    return useSceneStore.subscribe((state, previous) => {
      if (state.highlighted !== previous.highlighted) apply(state.highlighted);
    });
  }, [highlightId]);

  return (
    <Link
      {...props}
      ref={ownRef}
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
