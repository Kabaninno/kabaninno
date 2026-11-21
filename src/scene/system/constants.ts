/** Visual radius of a category core at its true (system) size, world units. */
export const NODE_CORE_RADIUS = 0.24;

/** Corona shell radius relative to the core (the glow fades out before it). */
export const CORONA_SCALE = 2.4;

/**
 * Radius the system core occupies in planet focus, world units: the core
 * body (slightly enlarged in the system view) plus the inner glow — the
 * corona shrinks and dims while a planet is focused (SystemContent).
 */
export const CORE_KEEP_OUT = NODE_CORE_RADIUS * 1.1 * 1.6;

/** Comet core tail: length along the system's -X axis, world units. */
export const COMET_TAIL_LENGTH = 1.5;

/**
 * Volume the comet tail's particles fill (a capsule from the core, world
 * units relative to the core): the planet-focus camera keeps out of it.
 */
export const COMET_TAIL_CAPSULE = {
  end: [-(NODE_CORE_RADIUS * 0.9 + COMET_TAIL_LENGTH), 0.12, -0.45] as const,
  radius: 0.5,
} as const;

/** Outer radius of the full corona around a system core, world units. */
export const CORE_CORONA_RADIUS = NODE_CORE_RADIUS * 1.1 * CORONA_SCALE;

/** Below this the universe core shows instead of the system core. */
export const SYSTEM_DETAIL_EPSILON = 0.001;

/** How much of the system-view detail shows: focused and large enough on screen. */
export function systemDetail(focus: number, coreDiameterPx: number): number {
  const t = Math.min(Math.max((coreDiameterPx - 20) / 36, 0), 1);
  return focus * t * t * (3 - 2 * t);
}

/**
 * Visibility of a category's universe preview (orbit sparks and their tails):
 * gone once the route focuses the category, whatever the core's on-screen
 * size (MJ-F3-02: on phones the system detail never reached 1, so the sparks
 * stayed as soft planet-sized "ghost" discs on the orbits).
 */
export function previewVisibility(focus: number, detail: number): number {
  const t = Math.min(Math.max(Math.max(focus, detail) / 0.6, 0), 1);
  return 1 - t * t * (3 - 2 * t);
}
