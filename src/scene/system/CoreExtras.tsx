'use client';

import { forwardRef, useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  type Group,
  type ShaderMaterial,
} from 'three';
import { createRandom } from '../random';
import type { CoreExtra } from '../universe/core-styles';

/**
 * Geometry some core styles add around the core in the system view
 * (registry: universe/core-styles.ts `extra`). Sized in core radii; the
 * parent group scales them with the core.
 */
interface CoreExtraProps {
  kind: CoreExtra;
  material: ShaderMaterial;
  /** Particle count for the comet tail. */
  particles: number;
}

/** Forge: a toothed mechanical rim on the core's equator. */
function rimGeometry(): BufferGeometry {
  const teeth = 28;
  const shape = new Shape();
  for (let i = 0; i <= teeth * 4; i++) {
    const angle = (i / (teeth * 4)) * Math.PI * 2;
    const radius = i % 4 === 1 || i % 4 === 2 ? 1.62 : 1.5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new Path();
  hole.absarc(0, 0, 1.36, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 48,
  });
  geometry.translate(0, 0, -0.05);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function tailGeometry(count: number): BufferGeometry {
  const random = createRandom(0xc0e7);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) seeds[i] = random();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3));
  return geometry;
}

export const CoreExtraMesh = forwardRef<Group, CoreExtraProps>(function CoreExtraMesh(
  { kind, material, particles },
  ref,
) {
  const geometry = useMemo(
    () => (kind === 'forge-rim' ? rimGeometry() : tailGeometry(particles)),
    [kind, particles],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group ref={ref}>
      {kind === 'forge-rim' ? (
        <mesh geometry={geometry} material={material} />
      ) : (
        <points geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
      )}
    </group>
  );
});
