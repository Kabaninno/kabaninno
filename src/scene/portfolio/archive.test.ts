import { describe, expect, it } from 'vitest';
import { getCategories } from '~/content';
import { coreStyleSchema } from '~/content/schema';
import {
  computeCameraGoal,
  resolveSafeFrame,
  type CameraGoal,
  type SafeFrame,
} from '../camera/goals';
import type { SceneManifest, Vec3 } from '../types';
import { buildUniverseModel } from '../universe/model';
import {
  ARCHIVE,
  ARCHIVE_FACING,
  archiveBasis,
  archiveCenterOffset,
  archiveExtents,
  archiveGrid,
  archiveOffsets,
  archiveSlots,
} from './archive-layout';
import { FILTER_DIM, PROJECT_SIBLING_DIM, archiveCardTargets } from './archive-state';
import { EMBLEMS } from './emblems';

const categories = getCategories();

function manifestWith(projects: SceneManifest['projects']): SceneManifest {
  return {
    labels: { portfolio: 'Portfolio', configurator: 'Configurator', comingSoon: 'Soon' },
    categories: categories.map((category) => ({
      id: category.id,
      label: category.id.toUpperCase(),
      dna: category.dna,
      services: category.services.map((service) => ({
        slug: service.slug,
        label: service.slug,
        planet: service.planet,
      })),
    })),
    projects,
  };
}

const PROJECTS: SceneManifest['projects'] = [
  { slug: 'a', label: 'A', categories: ['telegram', 'web'] },
  { slug: 'b', label: 'B', categories: ['crm', 'automation'] },
  { slug: 'c', label: 'C', categories: ['ai', 'automation'] },
  { slug: 'd', label: 'D', categories: ['web', 'telegram', 'crm'] },
];
const model = buildUniverseModel(manifestWith(PROJECTS));

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('archive layout', () => {
  it('lays the wall out wider than tall, last row centred', () => {
    expect(archiveGrid(0)).toEqual({ rows: 0, cols: 0 });
    expect(archiveGrid(1)).toEqual({ rows: 1, cols: 1 });
    expect(archiveGrid(3)).toEqual({ rows: 1, cols: 3 });
    expect(archiveGrid(4)).toEqual({ rows: 2, cols: 2 });
    expect(archiveGrid(5)).toEqual({ rows: 2, cols: 3 });
    expect(archiveGrid(9)).toEqual({ rows: 3, cols: 3 });
    const five = archiveSlots(5);
    expect(five.slice(3).reduce((sum, [x]) => sum + x, 0)).toBeCloseTo(0, 9);
  });

  it('keeps cards apart and the wall centred, for any count', () => {
    for (let count = 1; count <= 12; count++) {
      const slots = archiveSlots(count);
      expect(slots).toHaveLength(count);
      const mean = slots.reduce<Vec3>((sum, slot) => add(sum, slot), [0, 0, 0]);
      expect(Math.abs(mean[0] / count)).toBeLessThan(1e-9);
      expect(Math.abs(mean[1] / count)).toBeLessThan(ARCHIVE.spacingY / 2 + 1e-9);
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const [a, b] = [slots[i]!, slots[j]!];
          const apartX = Math.abs(a[0] - b[0]) >= ARCHIVE.cardWidth + 0.3;
          const apartY = Math.abs(a[1] - b[1]) >= ARCHIVE.cardHeight + 0.3;
          expect(apartX || apartY).toBe(true);
        }
      }
      // Outer cards step back: a gallery curve, never forward.
      for (const [, , z] of slots) expect(z).toBeLessThanOrEqual(0);
    }
  });

  it('stands the wall in front of the cluster, facing the viewer', () => {
    const { right, up, facing } = archiveBasis();
    expect(dot(right, facing)).toBeCloseTo(0, 9);
    expect(dot(up, facing)).toBeCloseTo(0, 9);
    expect(dot(right, up)).toBeCloseTo(0, 9);
    expect(up[1]).toBeGreaterThan(0);
    expect(facing[2]).toBeGreaterThan(0); // toward the universe (the portfolio sits far back)
    for (const offset of archiveOffsets(4)) {
      const depth = dot(offset, ARCHIVE_FACING);
      expect(depth).toBeGreaterThan(ARCHIVE.forward - 0.5);
      expect(depth).toBeLessThanOrEqual(ARCHIVE.forward + 1e-9);
    }
    expect(dot(archiveCenterOffset(), ARCHIVE_FACING)).toBeCloseTo(ARCHIVE.forward, 9);
    expect(archiveExtents(0)).toEqual({ halfWidth: 0, halfHeight: 0 });
    const extents = archiveExtents(4);
    expect(extents.halfWidth).toBeCloseTo(ARCHIVE.spacingX / 2 + ARCHIVE.cardWidth / 2, 9);
    expect(extents.halfHeight).toBeCloseTo(ARCHIVE.spacingY / 2 + ARCHIVE.cardHeight / 2, 9);
  });
});

describe('archive projects (data-driven)', () => {
  it('takes colour and emblem from the main category, a chip per category', () => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    model.portfolio.projects.forEach((project, index) => {
      const source = PROJECTS[index]!;
      const main = byId.get(source.categories[0]!)!;
      expect(project.key).toBe(`project:${source.slug}`);
      expect(project.color).toBe(main.dna.color);
      expect(project.glow).toBe(main.dna.glow);
      expect(project.emblem).toBe(main.dna.core);
      expect(project.chips).toEqual(source.categories.map((id) => byId.get(id)!.dna.color));
      expect(project.categoryLabels).toEqual(source.categories.map((id) => id.toUpperCase()));
      expect(project.ordinal).toBe(index + 1);
      expect(project.offset).toEqual(archiveOffsets(PROJECTS.length)[index]);
    });
  });

  it('survives unknown categories and an empty portfolio', () => {
    const odd = buildUniverseModel(manifestWith([{ slug: 'x', label: 'X', categories: ['nope'] }]));
    expect(odd.portfolio.projects[0]!.emblem).toBeNull();
    expect(odd.portfolio.projects[0]!.chips).toEqual([]);
    const empty = buildUniverseModel(manifestWith([]));
    expect(empty.portfolio.projects).toEqual([]);
    expect(empty.portfolio.comingSoon).toBe(true);
  });

  it('has an emblem for every core style', () => {
    for (const style of coreStyleSchema.options) {
      const geometry = EMBLEMS[style].create(1);
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
      geometry.computeBoundingSphere();
      expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true);
      geometry.dispose();
    }
  });
});

describe('archive card targets', () => {
  const projects = model.portfolio.projects;

  it('hovers the highlighted card only', () => {
    const targets = archiveCardTargets(projects, 'project:b', null, null);
    expect(targets.map((t) => t.hover)).toEqual([0, 1, 0, 0]);
    expect(targets.every((t) => t.dim === 1 && t.select === 0)).toBe(true);
  });

  it('dims the siblings of a focused project', () => {
    const targets = archiveCardTargets(projects, null, 'c', null);
    expect(targets.map((t) => t.dim)).toEqual([
      PROJECT_SIBLING_DIM,
      PROJECT_SIBLING_DIM,
      1,
      PROJECT_SIBLING_DIM,
    ]);
  });

  it('lifts filtered cards and dims the rest, never the focused one (D87)', () => {
    const filter = new Set(['project:a', 'project:d']);
    const targets = archiveCardTargets(projects, null, null, filter);
    expect(targets.map((t) => t.select)).toEqual([1, 0, 0, 1]);
    expect(targets.map((t) => t.dim)).toEqual([1, FILTER_DIM, FILTER_DIM, 1]);
    const focused = archiveCardTargets(projects, null, 'b', filter);
    expect(focused[1]!.dim).toBe(1);
    // An empty filter or no filter (another route) changes nothing.
    for (const none of [new Set<string>(), null]) {
      expect(archiveCardTargets(projects, null, null, none).every((t) => t.dim === 1)).toBe(true);
    }
  });
});

describe('archive framing', () => {
  const views = [
    { width: 1440, height: 900, rect: { x: 0, y: 72, width: 960, height: 828 } },
    { width: 390, height: 844, rect: { x: 0, y: 64, width: 390, height: 300 } },
  ];

  /** Projects a world point like the rig (principal point at the frame centre), CSS px. */
  function projectPx(
    goal: CameraGoal,
    point: Vec3,
    width: number,
    height: number,
    frame: SafeFrame,
  ) {
    const f = scale(
      [
        goal.lookAt[0] - goal.position[0],
        goal.lookAt[1] - goal.position[1],
        goal.lookAt[2] - goal.position[2],
      ],
      1 / dist(goal.lookAt, goal.position),
    );
    const rl = Math.hypot(f[2], f[0]);
    const r: Vec3 = [-f[2] / rl, 0, f[0] / rl];
    const u: Vec3 = [
      r[1] * f[2] - r[2] * f[1],
      r[2] * f[0] - r[0] * f[2],
      r[0] * f[1] - r[1] * f[0],
    ];
    const rel: Vec3 = [
      point[0] - goal.position[0],
      point[1] - goal.position[1],
      point[2] - goal.position[2],
    ];
    const z = dot(rel, f);
    const tan = Math.tan((goal.fov * Math.PI) / 360);
    const aspect = width / height;
    return {
      x: (frame.x + frame.width / 2) * width + (dot(rel, r) / z / (tan * aspect)) * (width / 2),
      y: (frame.y + frame.height / 2) * height - (dot(rel, u) / z / tan) * (height / 2),
      z,
      camera: { r, u },
    };
  }

  /** Every corner of a camera-facing card lies inside the rect (1 px tolerance). */
  function cardInRect(
    goal: CameraGoal,
    center: Vec3,
    view: (typeof views)[number],
    frame: SafeFrame,
  ) {
    const { camera } = projectPx(goal, center, view.width, view.height, frame);
    return [-1, 1].every((sx) =>
      [-1, 1].every((sy) => {
        const corner = add(
          add(center, scale(camera.r, (sx * ARCHIVE.cardWidth) / 2)),
          scale(camera.u, (sy * ARCHIVE.cardHeight) / 2),
        );
        const p = projectPx(goal, corner, view.width, view.height, frame);
        const { rect } = view;
        return (
          p.z > 0 &&
          p.x >= rect.x - 1 &&
          p.x <= rect.x + rect.width + 1 &&
          p.y >= rect.y - 1 &&
          p.y <= rect.y + rect.height + 1
        );
      }),
    );
  }

  it('fits the whole wall of cards into the free rect (panel and sheet)', () => {
    for (const view of views) {
      const frame = resolveSafeFrame(view.rect, view.width, view.height);
      const goal = computeCameraGoal({ mode: 'portfolio' }, model, view.width / view.height, frame);
      for (const project of model.portfolio.projects) {
        expect(cardInRect(goal, add(model.portfolio.position, project.offset), view, frame)).toBe(
          true,
        );
      }
      // Head-on: the camera looks along -ARCHIVE_FACING.
      const back = scale(
        [
          goal.position[0] - goal.lookAt[0],
          goal.position[1] - goal.lookAt[1],
          goal.position[2] - goal.lookAt[2],
        ],
        1 / dist(goal.position, goal.lookAt),
      );
      back.forEach((value, axis) => expect(value).toBeCloseTo(ARCHIVE_FACING[axis]!, 9));
    }
  });

  it('frames a focused project inside the rect, closer than the wall view', () => {
    for (const view of views) {
      const frame = resolveSafeFrame(view.rect, view.width, view.height);
      const aspect = view.width / view.height;
      const wall = computeCameraGoal({ mode: 'portfolio' }, model, aspect, frame);
      for (const project of model.portfolio.projects) {
        const goal = computeCameraGoal(
          { mode: 'project', project: project.slug },
          model,
          aspect,
          frame,
        );
        const center = add(model.portfolio.position, project.offset);
        goal.lookAt.forEach((value, axis) => expect(value).toBeCloseTo(center[axis]!, 9));
        expect(cardInRect(goal, center, view, frame)).toBe(true);
        expect(dist(goal.position, goal.lookAt)).toBeLessThan(dist(wall.position, wall.lookAt));
        // The card fills a good part of the rect height.
        const top = projectPx(
          goal,
          add(center, [0, ARCHIVE.cardHeight / 2, 0]),
          view.width,
          view.height,
          frame,
        );
        const bottom = projectPx(
          goal,
          add(center, [0, -ARCHIVE.cardHeight / 2, 0]),
          view.width,
          view.height,
          frame,
        );
        expect(Math.abs(bottom.y - top.y)).toBeGreaterThan(view.rect.height * 0.35);
      }
    }
  });

  it('falls back to the wall for an unknown case and to the cluster with no cases', () => {
    const frame = resolveSafeFrame(views[0]!.rect, 1440, 900);
    const aspect = 1440 / 900;
    expect(computeCameraGoal({ mode: 'project', project: 'nope' }, model, aspect, frame)).toEqual(
      computeCameraGoal({ mode: 'portfolio' }, model, aspect, frame),
    );
    const empty = buildUniverseModel(manifestWith([]));
    const dormant = computeCameraGoal({ mode: 'portfolio' }, empty, aspect, frame);
    expect(dormant.lookAt).toEqual(empty.portfolio.position);
    expect(dist(dormant.position, dormant.lookAt)).toBeGreaterThan(9 - 1e-9);
  });
});
