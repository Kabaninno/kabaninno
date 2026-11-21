'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Vector3, type ShaderMaterial } from 'three';
import { MAX_UNIVERSE_NODES } from '../config';
import { qualityDefines, type QualityPreset } from '../quality';
import {
  minorNodesFragment,
  minorNodesVertex,
  networkLinksFragment,
  networkLinksVertex,
} from '../shaders/network';
import { fogUniforms, pointScale } from '../three-utils';
import type { Vec3 } from '../types';
import type { UniverseModel } from './model';
import {
  buildNetwork,
  type LinkEnd,
  type NetworkLinkKind,
  type NetworkModel,
} from './network-model';
import type { UniverseRuntimeRef } from './runtime';

/** Neutral tint of minor nodes before they take their anchor's colour. */
const MINOR_NEUTRAL = '#8FA6E8';
const KIND_CODE: Record<NetworkLinkKind, number> = { main: 0, dendrite: 1, minor: 2 };

interface NetworkProps {
  model: UniverseModel;
  runtime: UniverseRuntimeRef;
  preset: QualityPreset;
}

/**
 * The universe's neural network (art direction: nodes = capabilities, links
 * = integrations, impulses = data): minor glowing nodes and every link —
 * main ring, dendrites into the main nodes, the minor web — in two draw
 * calls. Main-node drift and hover emphasis come from the runtime arrays
 * (bound by reference), so the links of a highlighted node brighten and
 * fire impulses more often. The whole fabric fades while the camera focuses
 * a node (dive), the stars stay.
 */
export function Network({ model, runtime, preset }: NetworkProps) {
  const pointsRef = useRef<ShaderMaterial>(null);
  const linksRef = useRef<ShaderMaterial>(null);
  const network = useMemo(() => buildNetwork(model, preset.minorNodes), [model, preset.minorNodes]);
  const minor = useMemo(() => buildMinorAttributes(model, network), [model, network]);
  const links = useMemo(
    () => buildLinkAttributes(model, network, minor.colors, preset.linkSegments),
    [model, network, minor.colors, preset.linkSegments],
  );

  const pointUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      uTime: { value: 0 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
      uNetwork: { value: 1 },
      uDrift: { value: 1 },
    }),
    [],
  );
  const linkUniforms = useMemo(
    () => ({
      ...fogUniforms(),
      // Replaced by the runtime arrays (bound by reference) on the first frame.
      uOffsets: { value: Array.from({ length: MAX_UNIVERSE_NODES }, () => new Vector3()) },
      uEmphasis: { value: new Array<number>(MAX_UNIVERSE_NODES).fill(0) },
      uPresence: { value: new Array<number>(MAX_UNIVERSE_NODES).fill(1) },
      uTime: { value: 0 },
      uDrift: { value: 1 },
      uNetwork: { value: 1 },
      uPulses: { value: 1 },
    }),
    [],
  );

  useFrame((state) => {
    const rt = runtime.current;
    if (!rt) return;
    const points = pointsRef.current;
    if (points) {
      points.uniforms.uTime.value = rt.time;
      points.uniforms.uScale.value = pointScale(state);
      points.uniforms.uPixelRatio.value = state.viewport.dpr;
      points.uniforms.uNetwork.value = rt.network;
    }
    const lines = linksRef.current;
    if (lines) {
      lines.uniforms.uOffsets.value = rt.offsets;
      lines.uniforms.uEmphasis.value = rt.emphasis;
      lines.uniforms.uPresence.value = rt.presence;
      lines.uniforms.uTime.value = rt.time;
      lines.uniforms.uNetwork.value = rt.network;
      lines.uniforms.uPulses.value = rt.animated ? 1 : 0;
    }
  });

  const variant = preset.lowQualityShaders ? 'low' : 'full';
  const defines = qualityDefines(preset);

  return (
    <>
      {links.count > 0 ? (
        <lineSegments frustumCulled={false} renderOrder={0}>
          <bufferGeometry key={`links-${links.count}`}>
            <bufferAttribute attach="attributes-position" args={[links.positions, 3]} />
            <bufferAttribute attach="attributes-aT" args={[links.t, 1]} />
            <bufferAttribute attach="attributes-aEndA" args={[links.endA, 4]} />
            <bufferAttribute attach="attributes-aEndB" args={[links.endB, 4]} />
            <bufferAttribute attach="attributes-aSeed" args={[links.seed, 1]} />
            <bufferAttribute attach="attributes-aKind" args={[links.kind, 1]} />
            <bufferAttribute attach="attributes-aColor" args={[links.color, 3]} />
          </bufferGeometry>
          <shaderMaterial
            key={variant}
            ref={linksRef}
            uniforms={linkUniforms}
            vertexShader={networkLinksVertex}
            fragmentShader={networkLinksFragment}
            defines={{ ...defines, MAX_NODES: String(MAX_UNIVERSE_NODES) }}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </lineSegments>
      ) : null}
      {minor.count > 0 ? (
        <points frustumCulled={false} renderOrder={1}>
          <bufferGeometry key={`minor-${minor.count}`}>
            <bufferAttribute attach="attributes-position" args={[minor.positions, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[minor.sizes, 1]} />
            <bufferAttribute attach="attributes-aBrightness" args={[minor.brightness, 1]} />
            <bufferAttribute attach="attributes-aPhase" args={[minor.phases, 3]} />
            <bufferAttribute attach="attributes-aColor" args={[minor.colors, 3]} />
          </bufferGeometry>
          <shaderMaterial
            key={variant}
            ref={pointsRef}
            uniforms={pointUniforms}
            vertexShader={minorNodesVertex}
            fragmentShader={minorNodesFragment}
            defines={defines}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      ) : null}
    </>
  );
}

function buildMinorAttributes(model: UniverseModel, network: NetworkModel) {
  const count = network.minor.length;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const phases = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const neutral = new Color(MINOR_NEUTRAL);
  const tint = new Color();
  network.minor.forEach((node, i) => {
    positions.set(node.position, i * 3);
    phases.set(node.phase, i * 3);
    sizes[i] = node.size;
    brightness[i] = node.brightness;
    tint.copy(neutral).lerp(new Color(model.nodes[node.anchor]!.color), node.tint);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  });
  return { count, positions, sizes, brightness, phases, colors };
}

/**
 * Bakes every link: main links as gently bowed curves (`segments` pieces),
 * dendrites and minor links as straight segments. Each vertex carries both
 * ends (drift phase or main-node index) so the GPU can keep it attached.
 */
function buildLinkAttributes(
  model: UniverseModel,
  network: NetworkModel,
  minorColors: Float32Array,
  segments: number,
) {
  const pieces = network.links.map((link) => (link.kind === 'main' ? segments : 1));
  const vertexCount = pieces.reduce((sum, n) => sum + n * 2, 0);
  const positions = new Float32Array(vertexCount * 3);
  const t = new Float32Array(vertexCount);
  const endA = new Float32Array(vertexCount * 4);
  const endB = new Float32Array(vertexCount * 4);
  const seed = new Float32Array(vertexCount);
  const kind = new Float32Array(vertexCount);
  const color = new Float32Array(vertexCount * 3);
  const colorA = new Color();
  const colorB = new Color();
  const mixed = new Color();
  const endPosition = (end: LinkEnd): Vec3 =>
    end.kind === 'main' ? model.nodes[end.index]!.position : network.minor[end.index]!.position;
  const endColor = (end: LinkEnd, out: Color) =>
    end.kind === 'main'
      ? out.set(model.nodes[end.index]!.color)
      : out.setRGB(
          minorColors[end.index * 3]!,
          minorColors[end.index * 3 + 1]!,
          minorColors[end.index * 3 + 2]!,
        );
  const writeEnd = (target: Float32Array, v: number, end: LinkEnd) => {
    if (end.kind === 'main') {
      target.set([0, 0, 0, end.index + 1], v * 4);
    } else {
      const phase = network.minor[end.index]!.phase;
      target.set([phase[0], phase[1], phase[2], 0], v * 4);
    }
  };

  let v = 0;
  network.links.forEach((link, l) => {
    const start = endPosition(link.a);
    const end = endPosition(link.b);
    endColor(link.a, colorA);
    endColor(link.b, colorB);
    const n = pieces[l]!;
    const control = link.kind === 'main' ? bowControlPoint(start, end) : null;
    for (let s = 0; s < n; s++) {
      for (const step of [s, s + 1]) {
        const u = step / n;
        for (let axis = 0; axis < 3; axis++) {
          const a = start[axis]!;
          const b = end[axis]!;
          positions[v * 3 + axis] = control
            ? (1 - u) * (1 - u) * a + 2 * (1 - u) * u * control[axis]! + u * u * b
            : a + (b - a) * u;
        }
        mixed.copy(colorA).lerp(colorB, u);
        color[v * 3] = mixed.r;
        color[v * 3 + 1] = mixed.g;
        color[v * 3 + 2] = mixed.b;
        t[v] = u;
        writeEnd(endA, v, link.a);
        writeEnd(endB, v, link.b);
        seed[v] = link.seed;
        kind[v] = KIND_CODE[link.kind];
        v++;
      }
    }
  });
  return { positions, t, endA, endB, seed, kind, color, count: vertexCount };
}

/** Control point lifted away from the universe centre and slightly upward. */
function bowControlPoint(start: Vec3, end: Vec3): Vec3 {
  const mid: Vec3 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2];
  const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  const outward = Math.hypot(mid[0], mid[2]) || 1;
  const bow = length * 0.09;
  return [
    mid[0] + (mid[0] / outward) * bow,
    mid[1] + length * 0.05,
    mid[2] + (mid[2] / outward) * bow,
  ];
}
