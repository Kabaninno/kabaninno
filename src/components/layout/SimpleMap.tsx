'use client';

import type { CSSProperties } from 'react';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { usePathname } from '@/i18n/navigation';
import { ariaCurrentFor } from '@/lib/nav';
import { routeToSceneState } from '@/lib/route-state';
import { linesOf, litNodeIndex, percentOf, type MapNode, type MapView } from '@/lib/simple-map';
import type { SimpleMapData } from '@/lib/simple-map-data';
import { useSceneStore } from '@/store/scene';

/**
 * The interactive 2D map of simple mode (D124): a light, living stand-in for
 * the 3D scene, rendered only while `html[data-simple]` is set (CSS; display
 * none otherwise, so 3D visitors get neither links nor animations).
 *
 * - Home, portfolio, cases, configurator: the universe map, every node a real
 *   link (5 systems, portfolio, configurator), the current section marked.
 *   On the configurator the categories chosen in the wizard stay lit
 *   (`emphasis`, D81).
 * - System and planet pages: that system, its core and every planet on its
 *   orbit as links; the current planet is marked.
 * - Highlight is two-way with the HTML lists through the scene store's
 *   `highlighted` id: these links are HighlightLinks (they light list items
 *   and get `data-highlighted` from them), and the lines of the lit node
 *   light up here.
 * - Motion is CSS only, transform and opacity (compositor): a slow pulse of
 *   the nodes and rare impulses along the lines. Off under reduced motion.
 *
 * Placed after <main> in the DOM, so keyboard users reach the page content
 * first and the map links after it.
 */
const NO_EMPHASIS: readonly string[] = [];

export function SimpleMap({ data }: { data: SimpleMapData }) {
  const pathname = usePathname();
  // Only while the map is shown: in 3D mode, hovers must not re-render it.
  const highlighted = useSceneStore((state) => (state.simpleMode ? state.highlighted : null));
  const emphasis = useSceneStore((state) => (state.simpleMode ? state.emphasis : NO_EMPHASIS));
  const target = routeToSceneState(pathname);
  const system =
    target.mode === 'system' || target.mode === 'planet' ? data.systems[target.category] : null;
  const view = system?.view ?? data.universe;
  const label = system?.label ?? data.universeLabel;
  const lit = litNodeIndex(view, highlighted);
  const litLines = new Set(linesOf(view, lit));

  return (
    <nav
      aria-label={label}
      className={`simple-map ${system ? 'simple-map--system' : 'simple-map--universe'}`}
      data-simple-map={system ? 'system' : 'universe'}
    >
      <div
        className="simple-map-stage"
        style={{ '--map-ratio': `${view.width} / ${view.height}` } as CSSProperties}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${view.width} ${view.height}`}
        >
          {view.center
            ? view.orbits.map((orbit, index) => (
                <ellipse
                  key={index}
                  cx={view.center!.x}
                  cy={view.center!.y}
                  rx={orbit.rx}
                  ry={orbit.ry}
                  fill="none"
                  className={`simple-map-orbit ${lit === index + 1 ? 'is-lit' : ''}`}
                  style={{ color: view.nodes[index + 1]?.color }}
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}
          {view.links.map(([a, b], index) => (
            <line
              key={`${a}-${b}`}
              x1={view.nodes[a]!.x}
              y1={view.nodes[a]!.y}
              x2={view.nodes[b]!.x}
              y2={view.nodes[b]!.y}
              className={`simple-map-line ${litLines.has(index) ? 'is-lit' : ''}`}
              style={{ color: view.nodes[lit]?.color }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {view.impulses.map(([from, to], index) => (
          <Impulse key={`${from}-${to}`} view={view} from={from} to={to} index={index} />
        ))}

        {view.nodes.map((node, index) => (
          <MapLink
            key={node.key}
            node={node}
            view={view}
            index={index}
            current={ariaCurrentFor(pathname, node.path)}
            emphasised={emphasis.includes(node.key)}
          />
        ))}
      </div>
    </nav>
  );
}

function MapLink({
  node,
  view,
  index,
  current,
  emphasised,
}: {
  node: MapNode;
  view: MapView;
  index: number;
  current: 'page' | 'true' | undefined;
  emphasised: boolean;
}) {
  // Visual size relative to the stage width (container query units); the
  // link itself is a 44 px hit area around it.
  const size = `max(0.625rem, ${Math.round(((node.r * 2) / view.width) * 1000) / 10}cqw)`;
  return (
    <HighlightLink
      href={node.path}
      highlightId={node.key}
      aria-current={current}
      data-kind={node.kind}
      data-emphasis={emphasised ? '' : undefined}
      className="simple-map-node group"
      style={
        {
          ...percentOf(view, node.x, node.y),
          '--node-color': node.color,
          '--node-size': size,
          '--i': index,
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="simple-map-halo" />
      <span aria-hidden="true" className="simple-map-core" />
      <span className="simple-map-label">{node.label}</span>
    </HighlightLink>
  );
}

/**
 * A small light dot that travels from one node to another now and then. Its
 * start sits at the first node; the keyframes translate it by the distance
 * to the second node in container-query units of the stage, so the motion is
 * a pure transform (composited) at any size.
 */
function Impulse({
  view,
  from,
  to,
  index,
}: {
  view: MapView;
  from: number;
  to: number;
  index: number;
}) {
  const a = view.nodes[from]!;
  const b = view.nodes[to]!;
  return (
    <span
      aria-hidden="true"
      className="simple-map-impulse"
      style={
        {
          ...percentOf(view, a.x, a.y),
          '--dx': `${((b.x - a.x) / view.width) * 100}cqw`,
          '--dy': `${((b.y - a.y) / view.height) * 100}cqh`,
          '--impulse-color': b.color,
          '--impulse-delay': `${-index * 3.7}s`,
        } as CSSProperties
      }
    />
  );
}
