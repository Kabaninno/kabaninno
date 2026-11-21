/**
 * Screen-space sizing rules for universe nodes (pure, three-free).
 *
 * A node core has a true world radius (the system core the dive lands on)
 * and a minimum on-screen size. From afar the minimum wins, so every core
 * reads as a crisp signal point whatever the framing; while the camera dives
 * in, the world radius takes over, so on screen the node only ever grows
 * into the system core (it never shrinks or pops).
 */

/** CSS px per world unit at view depth `depth` (vertical FOV in degrees). */
export function pixelsPerUnit(viewportHeightPx: number, fovDeg: number, depth: number): number {
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  return viewportHeightPx / (2 * tan * Math.max(depth, 1e-4));
}

/** World radius that keeps a core of world radius `base` at least `minDiameterPx` wide. */
export function coreWorldRadius(base: number, minDiameterPx: number, pxPerUnit: number): number {
  if (!(pxPerUnit > 0)) return base;
  return Math.max(base, minDiameterPx / 2 / pxPerUnit);
}

/**
 * Scale of the orbit preview so its innermost orbit clears an enlarged core
 * by `clearance` (1 = touching). Never shrinks the preview below its true
 * system scale, so up close the orbits match the nested system exactly.
 */
export function orbitClearanceScale(
  coreRadius: number,
  innermostOrbit: number,
  clearance = 1.3,
): number {
  if (!(innermostOrbit > 0)) return 1;
  return Math.max(1, (coreRadius * clearance) / innermostOrbit);
}

/**
 * Extra emissive boost (0..1) for cores drawn close to their minimum size:
 * small framings (landscape phones) keep the core above the bloom threshold
 * instead of averaging into a grey disc (visual M3-04).
 */
export function smallCoreBoost(diameterPx: number): number {
  const t = Math.min(Math.max((diameterPx - 12) / (34 - 12), 0), 1);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * On-screen radius (CSS px) of what a universe node visibly occupies, for
 * the presence fade (a node never shows clipped by the free frame's edge,
 * visual MN-2, mn4, S5, S6): a category's orbit preview, the beacon's
 * stretched crystal with its glow, the portfolio's star cloud — not just
 * the core.
 */
export function nodeVisualRadiusPx(
  kind: 'category' | 'configurator' | 'portfolio',
  corePx: number,
  pxPerUnit: number,
  systemRadius = 0,
): number {
  const core = corePx / 2;
  switch (kind) {
    case 'category':
      return Math.max(core * 1.8, systemRadius * 0.8 * pxPerUnit);
    case 'configurator':
      // The crystal is 1.6× taller than wide, grows with emphasis and glows.
      return core * 3;
    case 'portfolio':
      return Math.max(core * 1.6, 2 * pxPerUnit);
  }
}

/** Presence fade: tolerance and fade distance beyond the free frame's edge, CSS px. */
export const PRESENCE_EDGE = { tolerance: 2, fade: 16 } as const;

/**
 * Presence target (1 = shown, 0 = faded) of a node of on-screen radius
 * `radius` centred at (x, y), against a free frame in the same px.
 */
export function presenceInFrame(
  x: number,
  y: number,
  radius: number,
  frame: { left: number; top: number; right: number; bottom: number },
): number {
  const outside = Math.max(
    frame.left - (x - radius),
    x + radius - frame.right,
    frame.top - (y - radius),
    y + radius - frame.bottom,
    0,
  );
  const t = Math.min(Math.max((outside - PRESENCE_EDGE.tolerance) / PRESENCE_EDGE.fade, 0), 1);
  return 1 - t * t * (3 - 2 * t);
}
