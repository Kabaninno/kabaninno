'use client';

import { useMemo } from 'react';
import { usePathname } from '@/i18n/navigation';
import { routeToSceneState, type SceneTarget } from '@/lib/route-state';

/** Current scene target derived from the URL (locale-less pathname). */
export function useSceneTarget(): SceneTarget {
  const pathname = usePathname();
  return useMemo(() => routeToSceneState(pathname), [pathname]);
}
