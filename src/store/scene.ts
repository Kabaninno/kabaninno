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
 * Camera flight state published by the scene (scene-engineer) so the UI can
 * time its reveals to the flight (e.g. show the home hero at progress ≥ 0.6).
 * `active` is true from the start of a programmatic flight until it settles;
 * `progress` goes 0 → 1 during it (1 when idle). The scene may update it every
 * frame while flying — consumers must select narrowly (e.g. a boolean
 * threshold) or use `useSceneStore.subscribe` to avoid per-frame re-renders.
 */
export interface FlightState {
  active: boolean;
  progress: number;
  /** Locale-less path the flight is heading to, or null when idle. */
  to: string | null;
}

/**
 * Transient scene UI state. Where the camera is (universe/system/planet) is
 * NOT stored here: it is derived from the URL (see lib/route-state.ts).
 */
interface SceneUiState {
  flight: FlightState;
  setFlight: (flight: FlightState) => void;
  /**
   * Locale-less path of the scene state the camera has SETTLED on (e.g.
   * "/services/web/"), published by the scene when a flight settles, a
   * reduced-motion cut completes, or the first frame of a deep link renders.
   * `null` until the scene is ready (and forever without WebGL). The UI
   * mirrors it to `html[data-scene-focus]` for automation (D45); it is
   * not a second source of truth — the URL still drives the scene.
   */
  focus: string | null;
  setFocus: (focus: string | null) => void;
  /**
   * Node ids (see `scene/node-ids.ts`, e.g. "category:web") the scene should
   * show as "selected" — set by the configurator from the draft's solution
   * types while its route is active, cleared (empty array) when leaving it.
   * Unlike `highlighted` (a transient hover/focus), emphasis is a steady
   * state; the scene renders both, highlight on top.
   */
  emphasis: readonly string[];
  setEmphasis: (ids: readonly string[]) => void;
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
  flight: { active: false, progress: 1, to: null },
  setFlight: (flight) => set({ flight }),
  focus: null,
  setFocus: (focus) => set({ focus }),
  emphasis: [],
  setEmphasis: (ids) =>
    set((state) =>
      state.emphasis.length === ids.length && state.emphasis.every((id, i) => id === ids[i])
        ? state
        : { emphasis: [...ids] },
    ),
  highlighted: null,
  setHighlighted: (highlighted) => set({ highlighted }),
  quality: 'high',
  setQuality: (quality) => set({ quality }),
  safeRect: null,
  setSafeRect: (safeRect) => set({ safeRect }),
}));
