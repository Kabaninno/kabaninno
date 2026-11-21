import { describe, expect, it } from 'vitest';
import {
  COLUMN_MIN_ASPECT,
  COLUMN_PREFERENCE,
  largestFreeRect,
  preferredFrameAspect,
  sameRect,
  type Rect,
} from './safe-rect';

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const hudDesktop: Rect = { x: 0, y: 0, width: 1440, height: 68 };
const hudPhone: Rect = { x: 0, y: 0, width: 390, height: 68 };

describe('largestFreeRect', () => {
  it('returns the whole viewport without obstacles', () => {
    expect(largestFreeRect(desktop, [])).toEqual({ x: 0, y: 0, width: 1440, height: 900 });
  });

  it('returns null for an empty viewport or a fully covered one', () => {
    expect(largestFreeRect({ width: 0, height: 900 }, [])).toBeNull();
    expect(largestFreeRect(phone, [{ x: -10, y: -10, width: 500, height: 900 }])).toBeNull();
  });

  it('ignores obstacles outside the viewport and clips partial ones', () => {
    const rect = largestFreeRect(desktop, [
      { x: 2000, y: 0, width: 100, height: 100 },
      { x: -50, y: -20, width: 1600, height: 88 },
    ]);
    expect(rect).toEqual({ x: 0, y: 68, width: 1440, height: 832 });
  });

  it('desktop home: picks the area right of the hero and above the category index', () => {
    const hero: Rect = { x: 40, y: 470, width: 576, height: 390 };
    const index: Rect = { x: 1190, y: 640, width: 210, height: 220 };
    const rect = largestFreeRect(desktop, [hudDesktop, hero, index]);
    expect(rect).toEqual({ x: 616, y: 68, width: 824, height: 572 });
  });

  it('desktop system view: the area left of the content panel, below the HUD', () => {
    const panel: Rect = { x: 988, y: 76, width: 440, height: 812 };
    expect(largestFreeRect(desktop, [hudDesktop, panel])).toEqual({
      x: 0,
      y: 68,
      width: 988,
      height: 832,
    });
  });

  it('desktop with a short panel still prefers the column left of it', () => {
    const panel: Rect = { x: 988, y: 76, width: 440, height: 380 };
    const rect = largestFreeRect(desktop, [hudDesktop, panel]);
    expect(rect).toEqual({ x: 0, y: 68, width: 988, height: 832 });
  });

  it('mobile home: between the HUD and the top of the hero block', () => {
    const hero: Rect = { x: 16, y: 410, width: 358, height: 250 };
    const chips: Rect = { x: 16, y: 680, width: 358, height: 140 };
    expect(largestFreeRect(phone, [hudPhone, hero, chips])).toEqual({
      x: 0,
      y: 68,
      width: 390,
      height: 342,
    });
  });

  it('mobile system view: between the HUD and the bottom sheet', () => {
    const sheet: Rect = { x: 0, y: 338, width: 390, height: 506 };
    expect(largestFreeRect(phone, [hudPhone, sheet])).toEqual({
      x: 0,
      y: 68,
      width: 390,
      height: 270,
    });
  });

  it('handles fractional overlay edges (60dvh sheet top at 337.6 px)', () => {
    const sheet: Rect = { x: 0, y: 337.6, width: 390, height: 506.4 };
    expect(largestFreeRect(phone, [hudPhone, sheet])).toEqual({
      x: 0,
      y: 68,
      width: 390,
      height: 270,
    });
    const hud: Rect = { x: 0, y: 0, width: 390, height: 68.4 };
    expect(largestFreeRect({ width: 390.2, height: 844 }, [hud, sheet])).toEqual({
      x: 0,
      y: 68,
      width: 390,
      height: 270,
    });
  });

  it('scores candidates by the preferred aspect, not by raw area', () => {
    // A wide strip (1440×300) vs. a squarer block (700×600): the block fits a
    // larger 1.5:1 box (466 px tall vs. 300 px).
    const obstacles: Rect[] = [{ x: 0, y: 300, width: 740, height: 600 }];
    expect(largestFreeRect(desktop, obstacles)).toEqual({ x: 740, y: 0, width: 700, height: 900 });
  });

  it('rounds edges to whole pixels', () => {
    const rect = largestFreeRect(desktop, [{ x: 0, y: 0, width: 1440, height: 67.6 }]);
    expect(rect).toEqual({ x: 0, y: 68, width: 1440, height: 832 });
  });
});

describe('largestFreeRect: column between hero and index (V2-02)', () => {
  // Overlay boxes measured on the built home page (HUD, hero section, index nav).
  const hud = (width: number): Rect => ({ x: 0, y: 0, width, height: 68 });

  it('1600×900: the centre column wins over the slightly larger corner band', () => {
    const viewport = { width: 1600, height: 900 };
    const hero: Rect = { x: 40, y: 501, width: 576, height: 359 };
    const index: Rect = { x: 1306, y: 561, width: 254, height: 299 };
    // Corner band 984×493 scores 493; the column 690×832 scores 460 (0.93×).
    expect(largestFreeRect(viewport, [hud(1600), hero, index])).toEqual({
      x: 616,
      y: 68,
      width: 690,
      height: 832,
    });
  });

  it('1920×1080: the wide centre column', () => {
    const viewport = { width: 1920, height: 1080 };
    const hero: Rect = { x: 40, y: 681, width: 576, height: 359 };
    const index: Rect = { x: 1626, y: 741, width: 254, height: 299 };
    expect(largestFreeRect(viewport, [hud(1920), hero, index])).toEqual({
      x: 616,
      y: 68,
      width: 1010,
      height: 1012,
    });
  });

  it('1440×900: a column at 0.72× of the band loses', () => {
    const hero: Rect = { x: 40, y: 501, width: 576, height: 359 };
    const index: Rect = { x: 1146, y: 561, width: 254, height: 299 };
    expect(largestFreeRect(desktop, [hudDesktop, hero, index])).toEqual({
      x: 616,
      y: 68,
      width: 824,
      height: 493,
    });
  });

  it('trims a narrow column from the bottom to the minimum aspect', () => {
    // 1536×864 uk: column 584×796 (aspect 0.73) scores 0.85× the band.
    const viewport = { width: 1536, height: 864 };
    const hero: Rect = { x: 40, y: 465, width: 576, height: 359 };
    const index: Rect = { x: 1200, y: 525, width: 296, height: 299 };
    const rect = largestFreeRect(viewport, [hud(1536), hero, index]);
    expect(rect).toEqual({ x: 616, y: 68, width: 584, height: 778 });
    expect(rect!.width / rect!.height).toBeGreaterThanOrEqual(COLUMN_MIN_ASPECT);
  });

  it('1366×768 compact hero: the band above the hero beats a thin column', () => {
    const viewport = { width: 1366, height: 768 };
    const hero: Rect = { x: 40, y: 459, width: 768, height: 269 };
    const index: Rect = { x: 1072, y: 429, width: 254, height: 299 };
    expect(largestFreeRect(viewport, [hud(1366), hero, index])).toEqual({
      x: 0,
      y: 68,
      width: 1072,
      height: 391,
    });
  });

  it('panel layouts keep the big area beside the panel', () => {
    const panel: Rect = { x: 988, y: 76, width: 440, height: 812 };
    const card: Rect = { x: 0, y: 700, width: 300, height: 200 };
    // The column between card and panel (688×832, 458) is far below the area
    // left of the panel (988×632, 632); the area touching x = 0 is no column.
    const rect = largestFreeRect(desktop, [hudDesktop, panel, card]);
    expect(rect).toEqual({ x: 0, y: 68, width: 988, height: 632 });
  });

  it('uses the documented constants', () => {
    expect(COLUMN_PREFERENCE).toBe(0.85);
    expect(COLUMN_MIN_ASPECT).toBe(0.75);
  });
});

describe('preferredFrameAspect', () => {
  it('is wider on landscape screens', () => {
    expect(preferredFrameAspect(desktop)).toBeGreaterThan(preferredFrameAspect(phone));
  });
});

describe('sameRect', () => {
  it('compares with a tolerance and handles null', () => {
    const a = { x: 0, y: 68, width: 988, height: 832 };
    expect(sameRect(a, { ...a, width: 988.4 })).toBe(true);
    expect(sameRect(a, { ...a, width: 990 })).toBe(false);
    expect(sameRect(null, null)).toBe(true);
    expect(sameRect(a, null)).toBe(false);
  });
});
