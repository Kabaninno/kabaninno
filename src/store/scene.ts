import { create } from 'zustand';

export type QualityTier = 'high' | 'medium' | 'low';

/**
 * The part of the viewport NOT covered by HTML overlays (HUD, hero block,
 * content panel, bottom sheet) for the current route, in CSS pixels relative
 * to the viewport's top-left corner. Published by the UI layer
 * (`components/layout/SafeAreaPublisher.tsx`, algorithm in
 * `lib/safe-rect.ts`), consumed by the camera (scene-engineer) to frame the
 * focus inside it.
 *
 * Semantics: the largest overlay-free rectangle, scored by how big a 1.5:1
 * (landscape) or 1:1 (portrait) box fits in it; whole pixels; no padding
 * (consumers add their own margin). Updated on resize, route change and
 * overlay size changes (never per frame); unchanged values are not re-set.
 */
export interface SafeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Transient scene UI state. Where the camera is (universe/system/planet) is
 * NOT stored here: it is derived from the URL (see lib/route-state.ts).
 */
interface SceneUiState {
  /** Highlighted node id, e.g. "category:web" — set from 3D hover or HTML focus. */
  highlighted: string | null;
  setHighlighted: (id: string | null) => void;
  quality: QualityTier;
  setQuality: (quality: QualityTier) => void;
  /** Free area for framing; `null` means the whole viewport is free. */
  safeRect: SafeRect | null;
  setSafeRect: (rect: SafeRect | null) => void;
}

export const useSceneStore = create<SceneUiState>()((set) => ({
  highlighted: null,
  setHighlighted: (highlighted) => set({ highlighted }),
  quality: 'high',
  setQuality: (quality) => set({ quality }),
  safeRect: null,
  setSafeRect: (safeRect) => set({ safeRect }),
}));
