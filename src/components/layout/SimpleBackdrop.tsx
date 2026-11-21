import type { CSSProperties } from 'react';
import { withBasePath } from '@/lib/base-path';
import { SIMPLE_SKY_TILES } from '@/lib/simple-sky';

/**
 * Static sky of simple (2D) mode (D94, D124): seeded star tiles in three
 * layers that twinkle out of step (opacity only, long staggered durations,
 * composited; still under reduced motion). The interactive map of nodes and
 * planets is `SimpleMap`. Server-rendered into every page but
 * `display: none` unless `html[data-simple]` is set (globals.css), so
 * browsers neither paint it nor fetch the tiles in 3D mode. Decorative.
 */
export function SimpleBackdrop() {
  const [near, far] = SIMPLE_SKY_TILES;
  const layer = (tile: (typeof SIMPLE_SKY_TILES)[number] | undefined, offset = '0 0') =>
    ({
      backgroundImage: tile ? `url("${withBasePath(tile.file)}")` : undefined,
      backgroundSize: tile ? `${tile.size}px ${tile.size}px` : undefined,
      backgroundPosition: offset,
    }) satisfies CSSProperties;

  return (
    <div className="simple-sky" aria-hidden="true">
      <div className="simple-sky-layer simple-sky-layer--a" style={layer(near)} />
      <div className="simple-sky-layer simple-sky-layer--b" style={layer(far)} />
      <div className="simple-sky-layer simple-sky-layer--c" style={layer(near, '613px 389px')} />
    </div>
  );
}
