import type { CategoryDna } from '~/content/schema';
import {
  cometStyle,
  forgeStyle,
  neuralStyle,
  prismStyle,
  strataStyle,
} from '../shaders/core-styles';

export type CoreStyle = CategoryDna['core'];

/** Extra geometry some core styles add around the core in the system view. */
export type CoreExtra = 'forge-rim' | 'comet-tail';

/**
 * Registry: DNA `core` value → system-view core. Each style is its own
 * program (`chunk`, see shaders/core-styles.ts); `deform` swells the sphere
 * in the vertex shader; `extra` adds a component (system/CoreExtras.tsx).
 * A new `core` enum value only needs an entry here (TypeScript enforces it).
 */
export interface CoreStyleEntry {
  chunk: string;
  deform: boolean;
  extra: CoreExtra | null;
}

export const CORE_STYLES: Record<CoreStyle, CoreStyleEntry> = {
  prism: { chunk: prismStyle, deform: false, extra: null },
  strata: { chunk: strataStyle, deform: false, extra: null },
  forge: { chunk: forgeStyle, deform: false, extra: 'forge-rim' },
  neural: { chunk: neuralStyle, deform: true, extra: null },
  comet: { chunk: cometStyle, deform: false, extra: 'comet-tail' },
};
