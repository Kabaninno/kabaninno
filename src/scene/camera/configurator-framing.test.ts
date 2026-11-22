import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../types';
import {
  CONFIGURATOR_FRAMING,
  chooseCandidate,
  compareCandidates,
  frameConfigurator,
  framingAzimuth,
  framingCandidates,
  nearestAzimuthIndex,
  type ConfiguratorFramingInput,
  type ConfiguratorViewMemo,
  type FramingCandidate,
  type FramingSubject,
} from './configurator-framing';
import { FULL_FRAME } from './goals';

function candidate(overrides: Partial<FramingCandidate>): FramingCandidate {
  return {
    index: 0,
    azimuth: 0,
    position: [0, 0, 0],
    lookAt: [0, 0, -1],
    distance: 20,
    fits: true,
    linksClear: true,
    labelsClear: true,
    othersClear: true,
    labelsTidy: true,
    visible: 2,
    score: 100,
    linkGapPx: 40,
    labels: [],
    ...overrides,
  };
}

/** Eight candidates with the given scores (all valid unless overridden). */
function ring(scores: number[], overrides: Partial<FramingCandidate>[] = []): FramingCandidate[] {
  return scores.map((score, index) =>
    candidate({ index, azimuth: framingAzimuth(index), score, ...(overrides[index] ?? {}) }),
  );
}

describe('azimuth candidates', () => {
  it('are the 8 directions every 45°', () => {
    expect(CONFIGURATOR_FRAMING.azimuthCount).toBe(8);
    for (let i = 0; i < 8; i++) expect(framingAzimuth(i)).toBeCloseTo((i * Math.PI) / 4, 12);
    expect(nearestAzimuthIndex(0)).toBe(0);
    expect(nearestAzimuthIndex(Math.PI / 4 + 0.1)).toBe(1);
    expect(nearestAzimuthIndex(-Math.PI / 4)).toBe(7);
    expect(nearestAzimuthIndex(Math.PI * 2 + 0.05)).toBe(0);
  });
});

describe('azimuth choice and hysteresis', () => {
  it('picks the largest minimum crystal-to-node distance among valid candidates', () => {
    const scores = [80, 120, 95, 140, 60, 70, 110, 90];
    expect(chooseCandidate(ring(scores))).toBe(3);
    // Overlapping links or labels, or no fit, never beat a valid candidate.
    const invalid = ring(scores, [
      {},
      {},
      {},
      { linksClear: false },
      {},
      {},
      { labelsClear: false },
    ]);
    expect(chooseCandidate(invalid)).toBe(1);
    const unfit = ring(scores, [{}, { fits: false }, {}, { fits: false }]);
    expect(chooseCandidate(unfit)).toBe(6);
  });

  it('keeps the current azimuth unless the best beats it by 15 % or more', () => {
    const h = CONFIGURATOR_FRAMING.hysteresis;
    expect(h).toBe(0.15);
    // Best 114 vs current 100: < 15 % better → keep.
    expect(chooseCandidate(ring([100, 114, 50, 50, 50, 50, 50, 50]), 0)).toBe(0);
    // Best 115 vs current 100: exactly 15 % → switch.
    expect(chooseCandidate(ring([100, 115, 50, 50, 50, 50, 50, 50]), 0)).toBe(1);
    expect(chooseCandidate(ring([100, 130, 50, 50, 50, 50, 50, 50]), 0)).toBe(1);
    // No current: the best.
    expect(chooseCandidate(ring([100, 114, 50, 50, 50, 50, 50, 50]))).toBe(1);
    // A current candidate that became invalid is left even for a weaker valid one.
    const broken = ring([100, 90, 50, 50, 50, 50, 50, 50], [{ linksClear: false }]);
    expect(chooseCandidate(broken, 0)).toBe(1);
  });

  it('prefers views where no unselected node crowds the crystal or a selected node', () => {
    const crowded = ring([200, 150, 50, 50, 50, 50, 50, 50], [{ othersClear: false }]);
    expect(chooseCandidate(crowded)).toBe(1);
    // …but never over a view whose links or labels overlap.
    const broken = ring(
      [200, 150, 50, 50, 50, 50, 50, 50],
      [
        { othersClear: false },
        { labelsClear: false },
        { linksClear: false },
        { linksClear: false },
        { linksClear: false },
        { linksClear: false },
        { linksClear: false },
        { linksClear: false },
      ],
    );
    expect(chooseCandidate(broken)).toBe(0);
  });

  it('ranks free zones where nothing fits by how many nodes stay visible', () => {
    const band = ring(
      [30, 80, 20, 20, 20, 20, 20, 20],
      [
        { fits: false, visible: 3 },
        { fits: false, visible: 1 },
        { fits: false, visible: 2 },
        { fits: false, visible: 1 },
        { fits: false, visible: 1 },
        { fits: false, visible: 1 },
        { fits: false, visible: 1 },
        { fits: false, visible: 1 },
      ],
    );
    expect(chooseCandidate(band)).toBe(0);
    expect(compareCandidates(band[0]!, band[1]!)).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Fit                                                                       */
/* ------------------------------------------------------------------------ */

const VIEW = { width: 1600, height: 900 };

function subject(key: string, position: Vec3, label = true): FramingSubject {
  return {
    key,
    position,
    radius: 0.5,
    radiusPx: 30,
    corePx: 24,
    label: label ? { width: 120, height: 32 } : null,
  };
}

function input(nodes: FramingSubject[], overrides: Partial<ConfiguratorFramingInput> = {}) {
  return {
    crystal: { ...subject('crystal', [0, 0, 0], false), radiusPx: 27 },
    nodes,
    fov: 50,
    viewport: VIEW,
    frame: FULL_FRAME,
    free: FULL_FRAME,
    margin: CONFIGURATOR_FRAMING.margin,
    labelInsetPx: 24,
    minDistance: 9,
    maxDistance: 60,
    sway: CONFIGURATOR_FRAMING.sway,
    ...overrides,
  } satisfies ConfiguratorFramingInput;
}

describe('configurator fit', () => {
  it('never comes closer than the crystal close-up', () => {
    // A node right next to the crystal would fit much closer: clamped to the close-up.
    for (const c of framingCandidates(input([subject('a', [0.6, 0.3, 0])]))) {
      expect(c.fits).toBe(true);
      expect(c.distance).toBeGreaterThanOrEqual(9 - 1e-6);
      // The crystal itself is at the close-up distance (the node is a little off it).
      expect(Math.hypot(...sub([0, 0, 0], c.position))).toBeGreaterThanOrEqual(9 - 1e-6);
      expect(c.distance).toBeLessThan(9.8);
    }
  });

  it('never goes farther than the overview, and then reports it does not fit', () => {
    const candidates = framingCandidates(input([subject('a', [400, 0, 0])]));
    for (const c of candidates) expect(c.distance).toBeLessThanOrEqual(60 + 1e-6);
    // Seen across the line crystal → node (azimuth 0° and 180°): far too wide for 60 units.
    for (const index of [0, 4]) {
      expect(candidates[index]!.fits).toBe(false);
      expect(candidates[index]!.distance).toBeCloseTo(60, 6);
    }
  });

  it('fits between the bounds otherwise, the farther the wider the group', () => {
    // Seen from azimuth 0° (along +z), the node is to the side of the crystal.
    const near = framingCandidates(input([subject('a', [14, 2, 0])]))[0]!;
    const far = framingCandidates(input([subject('a', [28, 2, 0])]))[0]!;
    expect(near.fits && far.fits).toBe(true);
    expect(near.distance).toBeGreaterThan(9);
    expect(far.distance).toBeGreaterThan(near.distance);
    expect(far.distance).toBeLessThan(60);
  });

  it('remembers its choice and label sides, and re-solves only that side when asked', () => {
    const memo: ConfiguratorViewMemo = {};
    const nodes = [subject('a', [8, 2, 0]), subject('b', [-3, 4, 6])];
    const first = frameConfigurator(input(nodes), memo);
    expect(memo.index).toBe(first.index);
    expect(memo.labels?.map((entry) => entry.key)).toEqual(['a', 'b']);
    // A slightly smaller free zone (sheet drag): same side, refitted.
    const smaller = { ...FULL_FRAME, height: 0.9 };
    const quick = frameConfigurator(input(nodes, { free: smaller }), memo, undefined, true);
    expect(quick.index).toBe(first.index);
    expect(quick.labels).toEqual(first.labels);
    expect(quick.distance).toBeGreaterThanOrEqual(first.distance - 1e-6);
  });

  it('prefers the side the camera looks from on the first framing (within the hysteresis)', () => {
    const nodes = [subject('a', [8, 2, 0])];
    const best = frameConfigurator(input(nodes));
    const candidates = framingCandidates(input(nodes));
    for (let seed = 0; seed < 8; seed++) {
      const chosen = frameConfigurator(input(nodes), {}, framingAzimuth(seed));
      const kept = candidates[seed]!;
      if (chosen.index === seed) {
        expect(best.score).toBeLessThan(kept.score * 1.15 + 1e-9);
      } else {
        expect(chosen.index).toBe(best.index);
      }
    }
  });

  it('flags an unselected node in front of a selected one', () => {
    const nodes = [subject('a', [12, 0, 0])];
    // Seen from azimuth 90° (camera on +x), a node halfway between crystal and `a` covers both.
    const blocked = framingCandidates(
      input(nodes, { others: [{ position: [6, 0.2, 0], corePx: 24 }] }),
    )[2]!;
    expect(blocked.othersClear).toBe(false);
    // Far off to the side, it does not matter.
    const aside = framingCandidates(
      input(nodes, { others: [{ position: [6, 0, 60], corePx: 24 }] }),
    )[2]!;
    expect(aside.othersClear).toBe(true);
  });

  it('reserves room for the drift of the nodes', () => {
    const still = framingCandidates(input([subject('a', [14, 2, 0])]))[0]!;
    const drifting = framingCandidates(input([{ ...subject('a', [14, 2, 0]), drift: 0.4 }]))[0]!;
    expect(drifting.distance).toBeGreaterThan(still.distance);
  });

  it('keeps label text off the links when that costs little distance', () => {
    // One node to the side of the crystal: its label hangs away from its own link.
    const one = framingCandidates(input([subject('a', [10, 1, 0])]))[0]!;
    expect(one.labelsTidy).toBe(true);
    expect(one.labels[0]!.side).toBe(1);
  });

  it('keeps the crystal inside a free zone too small for everything', () => {
    // A 40 px band at the top of a full frame: only the crystal is guaranteed.
    const band = { x: 0, y: 0.1, width: 1, height: 40 / VIEW.height };
    const c = frameConfigurator(
      input([subject('a', [0, 14, 0], false), subject('b', [0, -9, 4], false)], {
        free: band,
        margin: 0,
      }),
    );
    expect(c.fits).toBe(false);
    // Project the crystal with the candidate's camera (up = +Y, principal point at the centre).
    const forward = normalize(sub(c.lookAt, c.position));
    const right = normalize([-forward[2], 0, forward[0]]);
    const up: Vec3 = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];
    const rel = sub([0, 0, 0], c.position);
    const z = dot(rel, forward);
    const y =
      VIEW.height / 2 - (dot(rel, up) / z / Math.tan((50 * Math.PI) / 360)) * (VIEW.height / 2);
    expect(y).toBeGreaterThanOrEqual(band.y * VIEW.height - 0.5);
    expect(y).toBeLessThanOrEqual((band.y + band.height) * VIEW.height + 0.5);
  });
});

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
