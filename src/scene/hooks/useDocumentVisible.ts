'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const getSnapshot = () => document.visibilityState !== 'hidden';
const getServerSnapshot = () => true;

/** False while the tab is hidden; used to stop the render loop entirely. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
