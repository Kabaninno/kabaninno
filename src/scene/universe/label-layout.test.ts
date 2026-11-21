import { describe, expect, it } from 'vitest';
import {
  LABEL_INSET,
  formatOrdinal,
  insetBounds,
  layoutLabel,
  type LabelInput,
  type LabelLayout,
} from './label-layout';

/** Desktop home free rect {616,68,824,564}, inset like NodeLabels does on desktop. */
const DESKTOP = insetBounds({ left: 616, top: 68, right: 1440, bottom: 632 }, LABEL_INSET.desktop);
/** Phone home free rect {0,68,360,208} at 360×780, inset like on touch. */
const PHONE = insetBounds({ left: 0, top: 68, right: 360, bottom: 276 }, LABEL_INSET.touch);

function input(overrides: Partial<LabelInput>): LabelInput {
  return {
    x: 900,
    y: 350,
    coreRadiusPx: 14,
    textWidth: 120,
    compactWidth: 100,
    textHeight: 34,
    bounds: DESKTOP,
    obstacles: [],
    ...overrides,
  };
}

function box(i: LabelInput, layout: LabelLayout) {
  const width = layout.compact ? i.compactWidth : i.textWidth;
  const left = i.x + layout.textX;
  const top = i.y + layout.textY;
  return { left, top, right: left + width, bottom: top + i.textHeight };
}

function inside(b: ReturnType<typeof box>, bounds: typeof DESKTOP) {
  return (
    b.left >= bounds.left - 1e-9 &&
    b.right <= bounds.right + 1e-9 &&
    b.top >= bounds.top - 1e-9 &&
    b.bottom <= bounds.bottom + 1e-9
  );
}

describe('layoutLabel', () => {
  it('hangs the label right and above by default, at normal spacing', () => {
    const i = input({});
    const layout = layoutLabel(i);
    expect(layout).toMatchObject({ side: 1, rise: 1, compact: false, clamped: false });
    expect(layout.reticle).toBeGreaterThanOrEqual(28);
    expect(layout.run).toBeGreaterThanOrEqual(i.textWidth);
    expect(inside(box(i, layout), DESKTOP)).toBe(true);
    // Text sits above the leader's horizontal leg.
    expect(i.y + layout.textY + i.textHeight).toBeLessThan(i.y - layout.reticle - layout.diagonal);
  });

  it('flips left near the right edge and below near the top edge', () => {
    expect(layoutLabel(input({ x: 1380 })).side).toBe(-1);
    expect(layoutLabel(input({ y: 110 })).rise).toBe(-1);
  });

  it('keeps the text off other nodes: tries the next placement', () => {
    const free = layoutLabel(input({}));
    const i = input({});
    const blocked = box(i, free);
    const obstacle = {
      x: (blocked.left + blocked.right) / 2,
      y: (blocked.top + blocked.bottom) / 2,
      r: 14,
    };
    const layout = layoutLabel(input({ obstacles: [obstacle] }));
    expect(layout.side === 1 && layout.rise === 1).toBe(false);
    const b = box(i, layout);
    const nx = Math.min(Math.max(obstacle.x, b.left), b.right);
    const ny = Math.min(Math.max(obstacle.y, b.top), b.bottom);
    expect(Math.hypot(obstacle.x - nx, obstacle.y - ny)).toBeGreaterThanOrEqual(obstacle.r);
  });

  it('fits "STRONY I APLIKACJE" on a 360 px phone without clipping (V2-03)', () => {
    // Web node near the right of the band; text 172 px wide (148 compact).
    const i = input({
      x: 270,
      y: 150,
      bounds: PHONE,
      textWidth: 172,
      compactWidth: 148,
      coreRadiusPx: 9,
    });
    const layout = layoutLabel(i);
    expect(inside(box(i, layout), PHONE)).toBe(true);
    expect(layout.side).toBe(-1);
  });

  it('falls back to compact spacing, then clamps inside the free area', () => {
    const narrow = insetBounds({ left: 0, top: 68, right: 300, bottom: 276 }, LABEL_INSET.touch);
    const compact = input({ x: 150, y: 170, bounds: narrow, textWidth: 140, compactWidth: 70 });
    const fitted = layoutLabel(compact);
    expect(fitted.compact).toBe(true);
    expect(fitted.clamped).toBe(false);
    expect(inside(box(compact, fitted), narrow)).toBe(true);

    const hopeless = input({ x: 150, y: 170, bounds: narrow, textWidth: 260, compactWidth: 240 });
    const clamped = layoutLabel(hopeless);
    expect(clamped.clamped).toBe(true);
    const b = box(hopeless, clamped);
    expect(b.left).toBeGreaterThanOrEqual(narrow.left - 1e-9);
    expect(b.right).toBeLessThanOrEqual(narrow.right + 1e-9);
    expect(b.top).toBeGreaterThanOrEqual(narrow.top - 1e-9);
  });

  it('formats the mono index', () => {
    expect(formatOrdinal(2, 5)).toBe('02 / 05');
    expect(formatOrdinal(12, 30)).toBe('12 / 30');
  });
});

describe('leader never crosses the text (S4)', () => {
  it('keeps the run above or below the text box, also when clamped', () => {
    // A huge reticle near the right edge of a phone frame (the dormant portfolio
    // cluster): nothing fits, the text is clamped into the bounds.
    const cases: LabelInput[] = [
      input({
        x: 300,
        y: 240,
        coreRadiusPx: 120,
        textWidth: 150,
        compactWidth: 140,
        bounds: PHONE,
      }),
      input({ x: 40, y: 90, coreRadiusPx: 90, textWidth: 150, compactWidth: 140, bounds: PHONE }),
      input({}),
      input({ x: 1400, y: 600, coreRadiusPx: 40 }),
    ];
    for (const i of cases) {
      const layout = layoutLabel(i);
      const top = layout.textY;
      const bottom = layout.textY + i.textHeight;
      const leader = layout.leaderY;
      expect(leader <= top || leader >= bottom, JSON.stringify(layout)).toBe(true);
    }
  });
});
