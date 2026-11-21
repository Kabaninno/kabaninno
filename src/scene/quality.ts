import type { QualityTier } from '@/store/scene';

/**
 * Per-tier budgets. `high` targets desktop at 60 fps, `low` weak phones at
 * 30+. The tier lives in the scene store: an initial guess from the device
 * (`initialQualityTier`), then adapted at runtime by PerformanceMonitor
 * (perf/QualityManager.tsx, steps down only). `sceneDpr` sets the DPR per tier.
 */
export interface QualityPreset {
  tier: QualityTier;
  /** Star counts per depth layer: [far, mid, near]. */
  starCounts: readonly [number, number, number];
  /** Background stars of the portfolio cluster. */
  clusterPoints: number;
  /** Minor network nodes: a prefix of the deterministic set (network-model.ts). */
  minorNodes: number;
  /** Segments per orbit line in the node orbit preview. */
  orbitSegments: number;
  /** Points per main network link curve. */
  linkSegments: number;
  /** Icosahedron detail of node cores. */
  coreDetail: number;
  /** Compiles shaders with the LOW_QUALITY define (no noise, no streaks). */
  lowQualityShaders: boolean;
  /** Bloom pass, or null for none. */
  bloom: { levels: number; multisampling: number } | null;
  /**
   * Share of the device DPR (capped at 2) the canvas renders at (`sceneDpr`,
   * the Canvas `dpr` prop). It changes only with the tier: no per-interaction
   * "regress", because every DPR change resizes the canvas, which clears its
   * drawing buffer (a visible blank frame if it lands between two renders).
   */
  dprScale: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  high: {
    tier: 'high',
    starCounts: [2600, 1200, 340],
    clusterPoints: 900,
    minorNodes: 150,
    orbitSegments: 96,
    linkSegments: 28,
    coreDetail: 5,
    lowQualityShaders: false,
    bloom: { levels: 6, multisampling: 2 },
    dprScale: 1,
  },
  medium: {
    tier: 'medium',
    starCounts: [1600, 800, 240],
    clusterPoints: 600,
    minorNodes: 100,
    orbitSegments: 64,
    linkSegments: 20,
    coreDetail: 4,
    lowQualityShaders: false,
    bloom: { levels: 5, multisampling: 0 },
    dprScale: 0.8,
  },
  low: {
    tier: 'low',
    starCounts: [900, 450, 160],
    clusterPoints: 320,
    minorNodes: 56,
    orbitSegments: 48,
    linkSegments: 12,
    coreDetail: 3,
    lowQualityShaders: true,
    bloom: null,
    dprScale: 0.6,
  },
};

/** `defines` object for ShaderMaterial; key the material by tier to recompile. */
export function qualityDefines(preset: QualityPreset): Record<string, string> {
  return preset.lowQualityShaders ? { LOW_QUALITY: '' } : {};
}

/**
 * Canvas DPR for a tier: the device ratio capped at 2 (BRIEF), times the
 * tier's share, two decimals (a stable value: R3F re-applies the Canvas
 * `dpr` prop on every render and resizes the canvas when it changes).
 */
export function sceneDpr(deviceDpr: number, preset: QualityPreset): number {
  const capped = Math.min(Math.max(deviceDpr, 0.5), 2);
  return Math.max(Math.round(capped * preset.dprScale * 100) / 100, 0.5);
}

const ORDER: readonly QualityTier[] = ['low', 'medium', 'high'];

/** One tier up (+1) or down (-1), clamped. */
export function stepQuality(tier: QualityTier, direction: 1 | -1): QualityTier {
  const index = ORDER.indexOf(tier) + direction;
  return ORDER[Math.min(Math.max(index, 0), ORDER.length - 1)]!;
}

export interface DeviceHints {
  /** Primary pointer is coarse (touch). */
  coarsePointer: boolean;
  hardwareConcurrency?: number;
  /** navigator.deviceMemory (GB), Chromium only. */
  deviceMemory?: number;
}

/**
 * Starting tier before PerformanceMonitor has measured anything: weak
 * hardware starts low, touch devices medium, everything else high.
 */
export function initialQualityTier(hints: DeviceHints): QualityTier {
  const cores = hints.hardwareConcurrency ?? 8;
  const memory = hints.deviceMemory ?? 8;
  if (cores <= 4 || memory <= 3) return 'low';
  return hints.coarsePointer ? 'medium' : 'high';
}

/**
 * `?quality=high|medium|low` pins the tier and disables runtime adaptation —
 * for screenshots and comparisons in headless browsers, where software GL
 * would otherwise make PerformanceMonitor step down to `low` (no bloom).
 */
export function parseQualityOverride(search: string): QualityTier | null {
  const value = new URLSearchParams(search).get('quality');
  return value === 'high' || value === 'medium' || value === 'low' ? value : null;
}
