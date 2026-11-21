import type { CSSProperties } from 'react';
import { getCategories } from '~/content';
import { withBasePath } from '@/lib/base-path';
import { SIMPLE_SKY_TILES, buildConstellation } from '@/lib/simple-sky';
import { PALETTE } from '@/scene/config';
import { CONFIGURATOR_POSITION, PORTFOLIO_POSITION, layoutCategoryNodes } from '@/scene/layout';

/**
 * Static cosmos of simple (2D) mode (D94, visual V2-05): seeded star tiles
 * and a flat constellation of the universe nodes in their category colours,
 * laid out like the 3D network (same layout function, simple projection).
 * Server-rendered into every page but `display: none` unless
 * `html[data-simple]` is set (globals.css), so browsers neither paint it nor
 * fetch the star tiles in 3D mode. Decorative: hidden from assistive tech.
 */
export function SimpleBackdrop() {
  const categories = getCategories();
  const positions = layoutCategoryNodes(
    categories.length,
    categories.map((category) => category.dna.universePosition),
  );
  const sky = buildConstellation({
    categories: categories.map((category, index) => ({
      id: category.id,
      color: category.dna.color,
      position: positions[index]!,
    })),
    portfolio: { color: PALETTE.portfolio, position: PORTFOLIO_POSITION },
    configurator: { color: 'var(--color-brand)', position: CONFIGURATOR_POSITION },
  });

  return (
    <div
      className="simple-sky"
      aria-hidden="true"
      // Painted by `.simple-sky::before` (globals.css), which fades the stars
      // behind the hero and the index.
      style={
        {
          '--sky-image': SIMPLE_SKY_TILES.map((tile) => `url("${withBasePath(tile.file)}")`).join(
            ', ',
          ),
          '--sky-size': SIMPLE_SKY_TILES.map((tile) => `${tile.size}px ${tile.size}px`).join(', '),
        } as CSSProperties
      }
    >
      <svg
        className="simple-constellation"
        viewBox={`0 0 ${sky.width} ${sky.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g stroke="rgb(255 255 255 / 0.16)" strokeWidth="1">
          {sky.links.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={sky.nodes[a]!.x}
              y1={sky.nodes[a]!.y}
              x2={sky.nodes[b]!.x}
              y2={sky.nodes[b]!.y}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        {sky.nodes.map((node) => (
          <g key={node.id} style={{ color: node.color }} fill="currentColor">
            <circle cx={node.x} cy={node.y} r={node.r * 5} opacity="0.07" />
            <circle cx={node.x} cy={node.y} r={node.r * 2.4} opacity="0.16" />
            {node.kind === 'portfolio' ? (
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r * 1.8}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.5"
                strokeDasharray="2 3"
              />
            ) : null}
            {node.kind === 'configurator' ? (
              <rect
                x={node.x - node.r * 0.9}
                y={node.y - node.r * 0.9}
                width={node.r * 1.8}
                height={node.r * 1.8}
                transform={`rotate(45 ${node.x} ${node.y})`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            ) : (
              <circle cx={node.x} cy={node.y} r={node.r} />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
