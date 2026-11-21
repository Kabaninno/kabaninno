'use client';

import { useEffect } from 'react';
import { REQUEST_STORAGE_KEY } from '@/lib/request-draft';
import { useRequestStore } from '@/store/request';

/**
 * Loads the persisted request draft once the page is interactive (never
 * during SSR or hydration, so server HTML and the first client render agree)
 * and keeps it in sync with other tabs. `serviceRefs` are the services of
 * this build (from content, built on the server), used to drop stale refs.
 */
export function RequestSync({ serviceRefs }: { serviceRefs: readonly string[] }) {
  useEffect(() => {
    const valid = new Set(serviceRefs);
    useRequestStore.getState().hydrate(valid);
    const onStorage = (event: StorageEvent) => {
      if (event.key === REQUEST_STORAGE_KEY || event.key === null) {
        useRequestStore.getState().hydrate(valid);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [serviceRefs]);

  return null;
}
