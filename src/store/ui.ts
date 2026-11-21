import { create } from 'zustand';

/**
 * Transient interface state shared across routes (not persisted).
 * - `sheetCollapsed`: the mobile bottom sheet is collapsed to its peek height,
 *   so the planet stays visible. It survives planet-to-planet navigation (a
 *   collapsed sheet must not pop open on every swipe) and resets on reload.
 */
interface UiState {
  sheetCollapsed: boolean;
  setSheetCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sheetCollapsed: false,
  setSheetCollapsed: (sheetCollapsed) => set({ sheetCollapsed }),
}));
