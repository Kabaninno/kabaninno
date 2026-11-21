'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  EdgesGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  RingGeometry,
  Vector3,
  WireframeGeometry,
  type Group,
  type InstancedMesh,
} from 'three';
import { paths } from '@/lib/routes';
import type { SceneBusRef } from '../bus';
import { sceneNodeId } from '../node-ids';
import { orbitPosition } from '../orbit-math';
import type { QualityPreset } from '../quality';
import { createRandom } from '../random';
import { pointScale } from '../three-utils';
import { HitZone } from '../universe/HitZone';
import type { CategoryNodeModel, OrbitPreview } from '../universe/model';
import { createMoonPose, moonPose } from './moon-layout';
import { MOON_SHAPES, PLANET_SHAPES } from './planet-geometry';
import { SHELL_SCALE, planetReach, planetScreenBoost, trailIntensity } from './planet-math';
import { needsEdgeOverlay, type PlanetMaterials } from './planet-materials';

/** Per-planet motion state, written by SystemContent before the planets read it. */
export interface PlanetRuntime {
  angle: number;
  /** Current speed multiplier (eases toward 1 / hovered / parked). */
  speed: number;
  /** Eased hover, 0..1. */
  hover: number;
  /** Materialized with the system detail, 0..1. */
  fade: number;
  /** CSS px per world unit at the planet (hit zone minimum size). */
  pxPerUnit: number;
}

export interface SystemRuntime {
  time: number;
  planets: PlanetRuntime[];
}

/** Minimum hit-zone diameter on screen (touch target), CSS px. */
const MIN_HIT_PX = 44;
/** Faces meeting at more than this angle get a glowing edge (clear bodies, BL-F3-01). */
const EDGE_ANGLE_DEG = 25;
/** Planet glow half size relative to the planet radius (smaller halos: MJ2). */
const GLOW_SIZE = 2.4;
const TRAIL_POINTS = 48;

interface PlanetProps {
  node: CategoryNodeModel;
  orbit: OrbitPreview;
  index: number;
  materials: PlanetMaterials;
  preset: QualityPreset;
  /** `prewarm`: mounted off-screen only to compile the programs. */
  mode: 'live' | 'prewarm';
  runtime?: RefObject<SystemRuntime | null>;
  busRef?: SceneBusRef;
  /** This planet is the URL focus (parked, no hit zone). */
  focused: boolean;
  /** The route is a planet route: clicks on siblings replace the entry (D16). */
  planetMode: boolean;
  onNavigate?: (path: string, replace?: boolean) => void;
}

/**
 * One service planet, assembled from the DNA registries: shape → geometry
 * (planet-geometry.ts), material → shader (planet-materials.ts), shell,
 * rings, moons (one instanced draw call), conveyor track, trail and glow.
 * Lives in the tilted system plane; moves on its orbit from the runtime
 * angle; scales in as the dive resolves the system. Hit zone: enlarged,
 * at least 44 px, off for the focused planet (QA N3).
 */
export function Planet({
  node,
  orbit,
  index,
  materials,
  preset,
  mode,
  runtime,
  busRef,
  focused,
  planetMode,
  onNavigate,
}: PlanetProps) {
  const groupRef = useRef<Group>(null);
  const spinRef = useRef<Group>(null);
  const shellRef = useRef<Group>(null);
  const moonsRef = useRef<InstancedMesh>(null);
  const hitRef = useRef<Group>(null);
  const scratch = useRef({
    point: { x: 0, y: 0, z: 0 },
    next: { x: 0, y: 0, z: 0 },
    tangent: new Vector3(),
    forward: new Vector3(0, 0, 1),
    quaternion: new Quaternion(),
    matrix: new Matrix4(),
    euler: new Euler(),
    position: new Vector3(),
    scale: new Vector3(),
    pose: createMoonPose(),
  });

  // Uniform writes go through a ref (the cached materials are shared objects).
  const materialsRef = useRef(materials);
  useEffect(() => {
    materialsRef.current = materials;
  }, [materials]);
  const { planet } = orbit;
  const shape = PLANET_SHAPES[planet.shape];
  const detail = preset.lowQualityShaders ? 0 : preset.tier === 'high' ? 2 : 1;
  const isDart = planet.shape === 'dart';

  const geometry = useMemo(() => {
    const created = shape.create(detail, index + node.index * 7);
    // The dart flies tip-first: its tip (+X) is turned to +Z, the tangent direction.
    if (isDart) created.rotateY(-Math.PI / 2);
    return created;
  }, [shape, detail, index, node.index, isDart]);
  const shellGeometry = useMemo(() => {
    if (planet.shell === 'wireframe') {
      const base = new IcosahedronGeometry(1, 1);
      const wire = new WireframeGeometry(base);
      base.dispose();
      return wire;
    }
    if (planet.shell === 'hologram') return new IcosahedronGeometry(1, 3);
    return null;
  }, [planet.shell]);
  const ringGeometries = useMemo(
    () => planet.rings.map((ring) => new RingGeometry(ring.inner, ring.outer, 96, 1)),
    [planet.rings],
  );
  const moonGeometry = useMemo(
    () => (planet.moons ? MOON_SHAPES[planet.moons.kind]() : null),
    [planet.moons],
  );
  const trackGeometry = useMemo(() => {
    if (planet.moons?.kind !== 'conveyor') return null;
    const segments = 72;
    const positions = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * planet.moons.radius;
      positions[i * 3 + 2] = Math.sin(angle) * planet.moons.radius;
    }
    const track = new BufferGeometry();
    track.setAttribute('position', new BufferAttribute(positions, 3));
    return track;
  }, [planet.moons]);
  const trailGeometry = useMemo(() => {
    if (!planet.trail) return null;
    const random = createRandom(0x7a11 + index);
    const t = new Float32Array(TRAIL_POINTS);
    const jitter = new Float32Array(TRAIL_POINTS);
    for (let i = 0; i < TRAIL_POINTS; i++) {
      t[i] = i / (TRAIL_POINTS - 1);
      jitter[i] = random();
    }
    const trail = new BufferGeometry();
    trail.setAttribute('position', new BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    trail.setAttribute('aT', new BufferAttribute(t, 1));
    trail.setAttribute('aJitter', new BufferAttribute(jitter, 1));
    return trail;
  }, [planet.trail, index]);

  // Clear glass with no shell: its edges glow (BL-F3-01), following the body's facets.
  const edgesGeometry = useMemo(
    () => (needsEdgeOverlay(planet) ? new EdgesGeometry(geometry, EDGE_ANGLE_DEG) : null),
    [planet, geometry],
  );
  // Imperatively created geometries are released here (materials belong to the cache).
  useEffect(
    () => () => {
      geometry.dispose();
      shellGeometry?.dispose();
      ringGeometries.forEach((ring) => ring.dispose());
      moonGeometry?.dispose();
      trackGeometry?.dispose();
      trailGeometry?.dispose();
      edgesGeometry?.dispose();
    },
    [
      geometry,
      shellGeometry,
      ringGeometries,
      moonGeometry,
      trackGeometry,
      trailGeometry,
      edgesGeometry,
    ],
  );

  const reach = planetReach(orbit);
  const key = `${node.categoryId}/${orbit.serviceSlug}`;

  useFrame((state, delta) => {
    if (mode !== 'live') return;
    const system = runtime?.current;
    const st = system?.planets[index];
    const group = groupRef.current;
    if (!system || !st || !group) return;
    const s = scratch.current;
    const visible = st.fade > 0.002;
    group.visible = visible;
    if (hitRef.current) hitRef.current.visible = visible;
    if (!visible) return;
    const time = system.time;

    orbitPosition(orbit, st.angle, s.point);
    group.position.set(s.point.x, s.point.y, s.point.z);
    // Small on screen (phone system views): the planet grows, its glow does not (MJ2).
    const boost = planetScreenBoost(orbit.size * shape.body, st.pxPerUnit);
    group.scale.setScalar(orbit.size * st.fade * boost);
    if (isDart) {
      // Point along the direction of travel.
      orbitPosition(orbit, st.angle + Math.sign(orbit.speed || 1) * 0.01, s.next);
      s.tangent.set(s.next.x - s.point.x, s.next.y - s.point.y, s.next.z - s.point.z).normalize();
      group.quaternion.setFromUnitVectors(s.forward, s.tangent);
    }
    const spin = spinRef.current;
    if (spin) {
      if (isDart) {
        spin.rotation.set(0, 0, time * shape.spin[1]);
      } else {
        spin.rotation.set(time * shape.spin[1], time * shape.spin[0], 0);
      }
    }
    if (shellRef.current) shellRef.current.rotation.set(time * 0.05, -time * 0.09, 0);

    const moons = moonsRef.current;
    if (moons && planet.moons) {
      const { kind, count, radius, speed } = planet.moons;
      for (let i = 0; i < count; i++) {
        const pose = moonPose(kind, i, count, time, radius, speed, s.pose);
        s.position.set(pose.x, pose.y, pose.z);
        s.quaternion.setFromEuler(s.euler.set(pose.rx, pose.ry, pose.rz));
        s.scale.set(pose.sx, pose.sy, pose.sz);
        moons.setMatrixAt(i, s.matrix.compose(s.position, s.quaternion, s.scale));
      }
      moons.instanceMatrix.needsUpdate = true;
    }

    const trail = materialsRef.current.trail;
    if (trail) {
      trail.uniforms.uHead.value = st.angle;
      trail.uniforms.uArc.value = Math.sign(orbit.speed || 1) * 1.1;
      trail.uniforms.uScale.value = pointScale(state);
      trail.uniforms.uPixelRatio.value = state.viewport.dpr;
      trail.uniforms.uTrail.value = trailIntensity(st.speed);
    }
    const m = materialsRef.current;
    m.glow.uniforms.uIntensity.value = (0.55 / boost) * st.fade * m.uniforms.uDim.value;
    m.glow.uniforms.uSize.value = orbit.size * GLOW_SIZE * Math.sqrt(boost);

    const hit = hitRef.current;
    if (hit) {
      hit.position.copy(group.position);
      hit.scale.setScalar(
        Math.max(reach * boost * 1.15, MIN_HIT_PX / 2 / Math.max(st.pxPerUnit, 1e-3)),
      );
    }
    void delta;
  }, 0);

  const moonCount = planet.moons?.count ?? 0;
  return (
    <>
      <group ref={groupRef}>
        <group ref={spinRef}>
          <mesh geometry={geometry} material={materials.surface} />
          {edgesGeometry && materials.edges ? (
            <lineSegments geometry={edgesGeometry} material={materials.edges} renderOrder={3} />
          ) : null}
        </group>
        {shellGeometry && materials.shell ? (
          <group ref={shellRef} scale={SHELL_SCALE}>
            {planet.shell === 'wireframe' ? (
              <lineSegments geometry={shellGeometry} material={materials.shell} />
            ) : (
              <mesh geometry={shellGeometry} material={materials.shell} renderOrder={3} />
            )}
          </group>
        ) : null}
        {planet.rings.map((ring, i) => (
          <group key={i} rotation={[0, 0, (ring.tilt * Math.PI) / 180]}>
            <mesh
              geometry={ringGeometries[i]}
              material={materials.rings[i]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={3}
            />
          </group>
        ))}
        {moonGeometry && materials.moons && moonCount > 0 ? (
          <instancedMesh
            ref={moonsRef}
            args={[moonGeometry, materials.moons, moonCount]}
            frustumCulled={false}
          />
        ) : null}
        {trackGeometry && materials.track ? (
          <lineLoop geometry={trackGeometry} material={materials.track} />
        ) : null}
        <mesh material={materials.glow} frustumCulled={false} renderOrder={4}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      </group>
      {trailGeometry && materials.trail ? (
        <points
          geometry={trailGeometry}
          material={materials.trail}
          frustumCulled={false}
          renderOrder={3}
        />
      ) : null}
      {mode === 'live' && busRef && onNavigate ? (
        <group ref={hitRef}>
          <HitZone
            radius={1}
            nodeKey={sceneNodeId.service(node.categoryId, orbit.serviceSlug)}
            path={paths.service(node.categoryId, orbit.serviceSlug)}
            onNavigate={onNavigate}
            replace={planetMode}
            busRef={busRef}
            gate={() =>
              busRef.current.systemInteractive === node.categoryId &&
              !focused &&
              (runtime?.current?.planets[index]?.fade ?? 0) > 0.5 &&
              (busRef.current.planetTargets.get(key)?.inFront ?? false)
            }
          />
        </group>
      ) : null}
    </>
  );
}
