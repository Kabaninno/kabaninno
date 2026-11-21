import type { QualityTier } from '@/store/scene';

/**
 * Per-tier budgets. `high` targets desktop at 60 fps, `low` weak phones at 30+.
 * The tier itself lives in the scene store (set by PerformanceMonitor in M6).
 */
export interface QualityPreset {
  /** Star counts per depth layer: [far, mid, near]. */
  starCounts: readonly [number, number, number];
  /** Background stars of the portfolio cluster. */
  clusterPoints: number;
  /** Segments per orbit line in the node orbit preview. */
  orbitSegments: number;
  /** Points per network link curve. */
  linkSegments: number;
  /** Compiles shaders with the LOW_QUALITY define (no noise, no streaks). */
  lowQualityShaders: boolean;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  high: {
    starCounts: [2600, 1200, 340],
    clusterPoints: 900,
    orbitSegments: 96,
    linkSegments: 28,
    lowQualityShaders: false,
  },
  medium: {
    starCounts: [1600, 800, 240],
    clusterPoints: 600,
    orbitSegments: 64,
    linkSegments: 20,
    lowQualityShaders: false,
  },
  low: {
    starCounts: [900, 450, 160],
    clusterPoints: 320,
    orbitSegments: 48,
    linkSegments: 12,
    lowQualityShaders: true,
  },
};

/** `defines` object for ShaderMaterial; key the material by tier to recompile. */
export function qualityDefines(preset: QualityPreset): Record<string, string> {
  return preset.lowQualityShaders ? { LOW_QUALITY: '' } : {};
}
