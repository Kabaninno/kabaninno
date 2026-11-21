import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Shape } from 'three';
import { ARCHIVE } from './archive-layout';

/** Bevel of the card slab (also widens the outline). */
const BEVEL = 0.012;
const CORNER = 0.14;

function roundedRect(width: number, height: number, radius: number): Shape {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/**
 * The card slab (a bevelled rounded rectangle, centred, front face at
 * z = +cardDepth / 2) and its outline (front and back loops as segments).
 */
export function createCardGeometry(detail: number): {
  slab: BufferGeometry;
  edges: BufferGeometry;
} {
  const shape = roundedRect(ARCHIVE.cardWidth - BEVEL * 2, ARCHIVE.cardHeight - BEVEL * 2, CORNER);
  const core = ARCHIVE.cardDepth - BEVEL * 2;
  const slab = new ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: detail > 0 ? 2 : 1,
    curveSegments: 4 + detail * 2,
  });
  slab.translate(0, 0, -core / 2);
  slab.computeBoundingSphere();

  const outline = roundedRect(ARCHIVE.cardWidth, ARCHIVE.cardHeight, CORNER + BEVEL).getPoints(
    4 + detail * 2,
  );
  // getPoints closes the loop by repeating the first point.
  const loop =
    outline.length > 1 && outline[0]!.equals(outline[outline.length - 1]!)
      ? outline.slice(0, -1)
      : outline;
  const positions = new Float32Array(loop.length * 2 * 2 * 3);
  let v = 0;
  for (const z of [ARCHIVE.cardDepth / 2, -ARCHIVE.cardDepth / 2]) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]!;
      const b = loop[(i + 1) % loop.length]!;
      positions.set([a.x, a.y, z, b.x, b.y, z], v * 3);
      v += 2;
    }
  }
  const edges = new BufferGeometry();
  edges.setAttribute('position', new BufferAttribute(positions, 3));
  edges.computeBoundingSphere();
  return { slab, edges };
}

/** Number of segments per observatory ring. */
const RING_SEGMENTS = 160;

/** Observatory ring radii around a wall of `count` cards (or the dormant cluster). */
export function observatoryRadii(halfWidth: number, halfHeight: number): number[] {
  const base = halfWidth > 0 ? Math.max(Math.hypot(halfWidth, halfHeight) + 0.55, 3) : 3.4;
  return [base, base * 1.16, base * 1.32];
}

/** Three concentric circles in the XY plane as line segments, with angle and ring index. */
export function createObservatoryRings(radii: readonly number[]): BufferGeometry {
  const count = radii.length * RING_SEGMENTS * 2;
  const positions = new Float32Array(count * 3);
  const angles = new Float32Array(count);
  const rings = new Float32Array(count);
  let v = 0;
  radii.forEach((radius, ring) => {
    for (let i = 0; i < RING_SEGMENTS; i++) {
      for (const step of [i, i + 1]) {
        const angle = (step / RING_SEGMENTS) * Math.PI * 2;
        positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, 0], v * 3);
        angles[v] = angle;
        rings[v] = ring;
        v++;
      }
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aAngle', new BufferAttribute(angles, 1));
  geometry.setAttribute('aRing', new BufferAttribute(rings, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
