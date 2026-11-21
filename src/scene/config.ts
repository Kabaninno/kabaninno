/**
 * Scene-wide constants for the "Signal Cosmos" art direction (see DECISIONS.md).
 * Three-free so pure modules (camera goals, layout model) and tests can use it.
 */

export const PALETTE = {
  void: '#05070D',
  deep: '#0A1024',
  fog: '#070B18',
  ink: '#E8ECF5',
  /** Distant silver "archive" globular cluster. */
  portfolio: '#DDE6FF',
  portfolioGlow: '#F4F7FF',
  /** Neutral beacon tint used when no category colors are available. */
  beacon: '#F1EEFF',
} as const;

/**
 * Camera clip planes. The near plane is adapted at runtime to the distance to
 * the look target (see CameraRig), so depth precision stays high both in the
 * universe overview (~30 units away) and when diving into a system nested at a
 * node (~1-4 units away). Far must contain the outermost star layer.
 */
export const CAMERA = {
  fov: 50,
  /** Wider vertical FOV for narrow portrait screens so the ring still fits. */
  portraitFov: 64,
  far: 600,
  minNear: 0.01,
  maxNear: 0.25,
  /** near = distance-to-target * nearFactor, clamped to [minNear, maxNear]. */
  nearFactor: 0.005,
} as const;

/** Light exponential-squared depth fog, applied manually in our shaders. */
export const FOG_DENSITY = 0.0105;

/**
 * Planetary systems are nested inside their universe node: one system unit
 * (core radius ~1, orbits 1.5-12, see content/schema.ts) equals this many world
 * units. The orbit preview drawn around each node uses the same scale, so the
 * "dive" in M2/M3 reveals exactly the orbits the visitor saw from afar.
 */
export const SYSTEM_SCALE = 0.22;

/** Base tilt (radians, around X) of every system plane, so orbits read as ellipses. */
export const SYSTEM_BASE_TILT = 0.38;

/**
 * Upper bound of nodes addressable by the network shader (uniform array size:
 * two arrays of this length stay well inside WebGL's minimum vertex uniform
 * budget). Categories get all slots except the portfolio and configurator.
 */
export const MAX_UNIVERSE_NODES = 32;

/** Documented limit of categories the universe can show (see buildUniverseModel). */
export const MAX_CATEGORY_NODES = MAX_UNIVERSE_NODES - 2;

/** Motion timings (seconds) — heavy and calm, no springs (DECISIONS: motion). */
export const MOTION = {
  /** smoothDamp time for camera position / look target (~1.5 s settle). */
  cameraSmoothTime: 0.62,
  lookSmoothTime: 0.52,
  fovSmoothTime: 0.6,
  /** Exponential rate for hover reactions (~150-200 ms). */
  hoverRate: 14,
  /** Exponential rate for focus / network fades. */
  focusRate: 3,
  /** Reduced-motion crossfade (fade out + fade in), ms. */
  reducedCutMs: 300,
  /** Canvas fade-in after the first rendered frame, ms. */
  fadeInMs: 1200,
} as const;
