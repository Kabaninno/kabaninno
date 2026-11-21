'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Live `matchMedia` result without effects or state mirroring. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** True for mouse / trackpad (hover-capable, precise) primary pointers. */
export function useFinePointer(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}
