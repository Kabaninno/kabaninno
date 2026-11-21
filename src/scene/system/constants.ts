/** Visual radius of a category core at its true (system) size, world units. */
export const NODE_CORE_RADIUS = 0.24;

/** Corona shell radius relative to the core (the glow fades out before it). */
export const CORONA_SCALE = 2.4;

/** Below this the universe core shows instead of the system core. */
export const SYSTEM_DETAIL_EPSILON = 0.001;

/** How much of the system-view detail shows: focused and large enough on screen. */
export function systemDetail(focus: number, coreDiameterPx: number): number {
  const t = Math.min(Math.max((coreDiameterPx - 20) / 36, 0), 1);
  return focus * t * t * (3 - 2 * t);
}
