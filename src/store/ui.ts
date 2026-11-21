import { create } from 'zustand';

/**
 * Transient interface state shared across routes (not persisted).
 * - `sheetCollapsed`: the mobile bottom sheet is collapsed to its peek height,
 *   so the planet stays visible. It survives planet-to-planet navigation (a
 *   collapsed sheet must not pop open on every swipe) and resets on reload.
 * - `webglUnavailable`: this browser cannot create a WebGL context although
 *   the API exists (a stored failure marker, or the scene just gave up,
 *   A-F3-04). Simple mode is then forced like without the API: the HUD
 *   switch is disabled and the loading indicator hidden (BootState).
 */
interface UiState {
  sheetCollapsed: boolean;
  setSheetCollapsed: (collapsed: boolean) => void;
  webglUnavailable: boolean;
  setWebglUnavailable: (unavailable: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sheetCollapsed: false,
  setSheetCollapsed: (sheetCollapsed) => set({ sheetCollapsed }),
  webglUnavailable: false,
  setWebglUnavailable: (webglUnavailable) => set({ webglUnavailable }),
}));
