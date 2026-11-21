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
