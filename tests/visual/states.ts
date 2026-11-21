import type { Page } from '@playwright/test';
import { sitePath, type ViewportName } from '../support/env';
import { withoutWebGL } from '../support/scene';
import { categories, localized, paths, type TestLocale } from '../support/site';

/**
 * Key states captured by `npm run screenshots` (BRIEF B2.7, C3). Data-driven:
 * systems and planets come from content, so new categories/services show up
 * without touching this file.
 *
 * To add a state (M3 planet focus, M4 configurator steps, M6 simple mode…),
 * append an entry: a `name` (file-safe, unique), a locale-prefixed `path`,
 * and optionally `init` (before the page loads: init scripts, emulated
 * media, storage), `prepare` (interact before the shot), `series` (several
 * frames), `viewports`, `scene: false` (pages without the canvas) or `tags`
 * (filter with `--only`). Examples for later milestones:
 *
 *   { name: 'configurator-step-2-pl', path: '/pl/configurator/',
 *     prepare: async (page) => { await page.getByRole('button', { name: … }).click(); } }
 *   { name: 'simple-mode-pl', path: '/pl/', scene: false, init: withoutWebGL }
 */

export interface CaptureContext {
  viewport: ViewportName;
  /** Takes one frame of a series: `${state.name}-${suffix}`. */
  frame: (suffix: string) => Promise<void>;
  /** Notes an event in the shot's timeline (manifest), e.g. "navigate". */
  mark: (event: string) => void;
}

export interface CaptureState {
  name: string;
  /** Locale-prefixed path without the base path, e.g. "/pl/services/web/". */
  path: string;
  /** Default: both. */
  viewports?: readonly ViewportName[];
  /** The page has no 3D scene (404): do not wait for the canvas. */
  scene?: boolean;
  /** Expected HTTP status of the document (default 200). */
  status?: number;
  /** Runs before the first navigation (init scripts, `emulateMedia`, storage). */
  init?: (page: Page) => Promise<void>;
  /** Interaction before the single shot (hover, open a menu…). */
  prepare?: (page: Page, context: CaptureContext) => Promise<void>;
  /** Replaces the single shot with a frame series (transitions). */
  series?: (page: Page, context: CaptureContext) => Promise<void>;
  /**
   * Installs Playwright's fake clock before the page loads, so a series can
   * step JS time (camera flight, hero gate) exactly; see `transitionFrames`.
   */
  clock?: boolean;
  tags?: readonly string[];
}

const pl = (path: string) => localized('pl', path);

/** The home index link of a locale-less path. */
function indexLink(page: Page, locale: TestLocale, path: string) {
  return page.locator(
    `nav[aria-labelledby="home-explore"] a[href="${sitePath(localized(locale, path))}"]`,
  );
}

/** Hover on desktop; keyboard focus on touch (both light the node up). */
async function point(page: Page, viewport: ViewportName, path: string, locale: TestLocale = 'pl') {
  const link = indexLink(page, locale, path);
  if (viewport === 'mobile') await link.focus();
  else await link.hover();
}

/** Scene-time offsets (ms after the route change) of the series frames f1–f5. */
const TRANSITION_OFFSETS_MS = [0, 300, 600, 900, 1200];

const isFlying = (page: Page) =>
  page.evaluate(() => document.documentElement.hasAttribute('data-scene-flight'));

/**
 * A transition as a frame series at exact scene-time offsets, then a settled
 * frame. JS time is stepped with Playwright's fake clock (the state needs
 * `clock: true`): the camera flight (GSAP + R3F frames) and the hero gate
 * advance by exactly the step, however slow software WebGL renders each
 * frame. Network, React's scheduler and CSS animations run in real time, so
 * the 150 ms exit fade and the panel entrance are already over in the
 * frames (e2e covers them).
 */
async function transitionFrames(
  page: Page,
  context: CaptureContext,
  prefix: string,
  navigate: () => Promise<void>,
  arrived: () => Promise<boolean>,
) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
  context.mark(`${prefix}: navigate`);
  await navigate();
  // Let the router commit the new route (16 ms JS steps, real network).
  for (let step = 0; step < 120 && !(await arrived()); step += 1) await page.clock.runFor(16);
  let sceneTime = 0;
  for (const [index, offset] of TRANSITION_OFFSETS_MS.entries()) {
    if (offset > sceneTime) await page.clock.runFor(offset - sceneTime);
    sceneTime = offset;
    context.mark(`${prefix}: scene t=${offset} ms`);
    await context.frame(`${prefix}-f${index + 1}`);
  }
  for (let step = 0; step < 40 && (await isFlying(page)); step += 1) await page.clock.runFor(100);
  await page.clock.runFor(500);
  await context.frame(`${prefix}-f${TRANSITION_OFFSETS_MS.length + 1}`);
  await page.clock.resume();
}

const first = categories[0]!;

export const STATES: CaptureState[] = [
  // Universe
  { name: 'universe-pl', path: pl(paths.home()), tags: ['universe'] },
  { name: 'universe-uk', path: localized('uk', paths.home()), tags: ['universe'] },
  {
    name: `hover-${first.id}-pl`,
    path: pl(paths.home()),
    tags: ['universe', 'hover'],
    prepare: (page, { viewport }) => point(page, viewport, first.path),
  },
  {
    name: 'hover-portfolio-pl',
    path: pl(paths.home()),
    tags: ['universe', 'hover'],
    prepare: (page, { viewport }) => point(page, viewport, paths.portfolio()),
  },
  {
    // Fallback without WebGL (precursor of the M6 simple mode).
    name: 'universe-no-webgl-pl',
    path: pl(paths.home()),
    scene: false,
    init: withoutWebGL,
    tags: ['universe', 'fallback'],
  },
  {
    name: 'menu-open-pl',
    path: pl(paths.home()),
    viewports: ['mobile'],
    tags: ['hud'],
    prepare: async (page) => {
      await page.locator('header button[aria-haspopup="dialog"]').click();
      await page.locator('dialog[open]').waitFor();
    },
  },

  // Systems (every category) and the first planet of every system (planet focus).
  ...categories.map((category): CaptureState => ({
    name: `system-${category.id}-pl`,
    path: pl(category.path),
    tags: ['system'],
  })),
  { name: `system-${first.id}-uk`, path: localized('uk', first.path), tags: ['system'] },
  {
    // Hovering (focus on touch) a planet in the system panel lights it up in the scene.
    name: `hover-planet-${first.id}-${first.services[0]!.slug}-pl`,
    path: pl(first.path),
    tags: ['system', 'hover', 'planet'],
    prepare: async (page, { viewport }) => {
      const link = page.locator(
        `main [data-route-ui] a[href="${sitePath(pl(first.services[0]!.path))}"]`,
      );
      if (viewport === 'mobile') await link.focus();
      else await link.hover();
    },
  },
  ...categories.map((category): CaptureState => ({
    name: `planet-${category.id}-${category.services[0]!.slug}-pl`,
    path: pl(category.services[0]!.path),
    tags: ['planet'],
  })),

  // Mobile bottom sheet on a planet: expanded (default) and collapsed by its handle.
  {
    name: `sheet-expanded-${first.id}-${first.services[0]!.slug}-pl`,
    path: pl(first.services[0]!.path),
    viewports: ['mobile'],
    tags: ['planet', 'sheet'],
  },
  {
    name: `sheet-collapsed-${first.id}-${first.services[0]!.slug}-pl`,
    path: pl(first.services[0]!.path),
    viewports: ['mobile'],
    tags: ['planet', 'sheet'],
    prepare: async (page) => {
      await page.locator('[data-sheet-handle]').click();
      await page.locator('[data-sheet="collapsed"]').waitFor();
      await page.waitForTimeout(400);
    },
  },

  // Other nodes
  { name: 'portfolio-pl', path: pl(paths.portfolio()), tags: ['portfolio'] },
  { name: 'configurator-pl', path: pl(paths.configurator()), tags: ['configurator'] },
  { name: 'configurator-uk', path: localized('uk', paths.configurator()), tags: ['configurator'] },
  { name: '404', path: '/pl/this-sector-is-empty/', scene: false, status: 404, tags: ['404'] },

  // Transition: home → first system (index link), then Back.
  {
    name: `transition-home-${first.id}`,
    path: pl(paths.home()),
    tags: ['transition'],
    clock: true,
    series: async (page, context) => {
      const at = (path: string) =>
        page.evaluate(
          ([target, heading]) =>
            location.pathname === target && document.querySelector(heading) !== null,
          [sitePath(pl(path)), 'main [data-route-ui] h1'] as const,
        );
      await transitionFrames(
        page,
        context,
        'in',
        () => indexLink(page, 'pl', first.path).click(),
        () => at(first.path),
      );
      await transitionFrames(
        page,
        context,
        'out',
        async () => {
          await page.goBack();
        },
        () => at(paths.home()),
      );
    },
  },
];
