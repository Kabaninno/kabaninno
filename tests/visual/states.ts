import type { Page } from '@playwright/test';
import { sitePath, type ViewportName } from '../support/env';
import { withSimpleMode, withoutWebGL, withoutWebGL2Api } from '../support/scene';
import { getAllProjects } from '~/content';
import { builtProjects, categories, localized, paths, type TestLocale } from '../support/site';

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
 *
 * Every state starts as a returning visitor (the first-visit intro is marked
 * as seen) unless it sets `intro: true`.
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
  /** Keep the first-visit intro (default: marked as seen before the page loads). */
  intro?: boolean;
  tags?: readonly string[];
}

const pl = (path: string) => localized('pl', path);

/** A complete configurator draft (valid ids from content and `content/configurator.ts`). */
const CONFIGURATOR_DRAFT = {
  types: ['web', 'crm'],
  features: ['web/online-stores', 'web/seo', 'crm/custom-crm'],
  business: { industry: 'retail', size: '2-10', hasWebsite: 'yes', hasCrm: 'no' },
  budget: '15k-40k',
  timeline: '1-3-months',
  contact: {
    name: 'Łucja Żółkiewska',
    comment: 'Sklep z integracją CRM i płatnościami online. Zależy nam na terminie przed sezonem.',
  },
};

/** Seeds the stored configurator draft (`kabaninno.configurator.v1`) on a given step. */
function seedConfigurator(step: string) {
  return async (page: Page) => {
    await page.addInitScript(
      (stored) => localStorage.setItem('kabaninno.configurator.v1', JSON.stringify(stored)),
      { v: 1, step, draft: CONFIGURATOR_DRAFT },
    );
  };
}

/**
 * Portfolio case states need visible cases, i.e. a preview built with drafts:
 *   npm run build:preview -- --drafts       (or: npm run screenshots -- --build=drafts)
 * On the default production build (no published cases) these states are
 * simply not generated; `portfolio-pl` then shows the "coming soon" panel.
 */
const built = builtProjects().map((project) => project.slug);
const builtCases = getAllProjects().filter((project) => built.includes(project.slug));
const filterCategory = categories.find((category) =>
  builtCases.some((project) => project.categories.includes(category.id)),
)?.id;
/** The first built case of each demo type (iframe facade, video, mockup). */
const demoCases = ['iframe', 'video', 'mockup'].flatMap((type) => {
  const project = builtCases.find((item) => item.demo?.type === type);
  return project ? [{ type, slug: project.slug }] : [];
});

const CONFIGURATOR_STEP_IDS = [
  'type',
  'features',
  'business',
  'budget',
  'timeline',
  'contact',
  'summary',
] as const;

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

/** A landscape phone (D40: side panel instead of a bottom sheet; M3-03: 44 px HUD targets). */
async function landscapePhone(page: Page) {
  await page.setViewportSize({ width: 740, height: 360 });
}

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
    // WebGL 2 API present but no context (blocklisted GPU): the scene gives up silently (D55).
    name: 'universe-no-webgl-pl',
    path: pl(paths.home()),
    scene: false,
    init: withoutWebGL,
    tags: ['universe', 'fallback'],
  },

  // Simple (2D) mode (D94): chosen in the HUD, or automatic without the WebGL 2 API.
  {
    name: 'simple-mode-pl',
    path: pl(paths.home()),
    scene: false,
    init: (page) => withSimpleMode(page),
    tags: ['simple'],
  },
  {
    name: `simple-mode-system-${first.id}-pl`,
    path: pl(first.path),
    scene: false,
    init: (page) => withSimpleMode(page),
    tags: ['simple'],
  },
  {
    name: `simple-mode-planet-${first.id}-${first.services[0]!.slug}-pl`,
    path: pl(first.services[0]!.path),
    scene: false,
    init: (page) => withSimpleMode(page),
    tags: ['simple'],
  },
  {
    // A map node hovered (desktop) / focused (touch): node, lines and index item lit.
    name: `simple-mode-hover-${first.id}-pl`,
    path: pl(paths.home()),
    scene: false,
    init: (page) => withSimpleMode(page),
    tags: ['simple', 'hover'],
    prepare: async (page, { viewport }) => {
      const link = page.locator(`nav[data-simple-map] a[href="${sitePath(pl(first.path))}"]`);
      if (viewport === 'mobile') await link.focus();
      else await link.hover();
    },
  },
  {
    name: 'simple-mode-auto-pl',
    path: pl(paths.home()),
    scene: false,
    init: withoutWebGL2Api,
    tags: ['simple', 'fallback'],
  },
  {
    // First visit: the intro plays with "Skip intro"; then Esc skips it.
    name: 'intro-pl',
    path: pl(paths.home()),
    scene: false,
    intro: true,
    tags: ['intro'],
    series: async (page, context) => {
      const skip = page.locator('[data-intro-skip]');
      const playing = await skip
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      context.mark(playing ? 'intro playing' : 'intro never started');
      await context.frame('playing');
      if (!playing) return;
      await page.keyboard.press('Escape');
      await skip.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(900);
      await context.frame('skipped');
    },
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

  // Landscape phone: side panel (D40) and 44 px touch targets in the HUD (M3-03).
  {
    name: `planet-landscape-${first.id}-${first.services[0]!.slug}-pl`,
    path: pl(first.services[0]!.path),
    viewports: ['mobile'],
    tags: ['planet', 'landscape'],
    init: landscapePhone,
  },

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
  // Every wizard step on desktop, seeded with a complete draft (no clicking through).
  ...CONFIGURATOR_STEP_IDS.map((step, index): CaptureState => ({
    name: `configurator-step-${index + 1}-${step}-pl`,
    path: pl(paths.configurator()),
    viewports: ['desktop'],
    tags: ['configurator', 'wizard'],
    init: seedConfigurator(step),
  })),
  {
    name: 'configurator-step-7-summary-uk',
    path: localized('uk', paths.configurator()),
    viewports: ['desktop'],
    tags: ['configurator', 'wizard'],
    init: seedConfigurator('summary'),
  },
  {
    name: 'configurator-summary-mobile-pl',
    path: pl(paths.configurator()),
    viewports: ['mobile'],
    tags: ['configurator', 'wizard', 'sheet'],
    init: seedConfigurator('summary'),
  },
  // Portfolio with cases (drafts builds only, see above).
  ...(filterCategory
    ? [
        {
          name: `portfolio-filter-${filterCategory}-pl`,
          path: `${pl(paths.portfolio())}?category=${filterCategory}`,
          tags: ['portfolio', 'drafts'],
        } satisfies CaptureState,
      ]
    : []),
  ...demoCases.map(({ type, slug }): CaptureState => ({
    name: `case-${type}-${slug}-pl`,
    path: pl(paths.project(slug)),
    tags: ['portfolio', 'case', 'drafts'],
    prepare: async (page) => {
      // Bring the demo to the top of the panel (V5-02: "if needed" did not
      // scroll when the heading was already partly visible).
      await page.locator('#project-demo').evaluate((element) => {
        element.scrollIntoView({ block: 'start' });
      });
    },
  })),

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
