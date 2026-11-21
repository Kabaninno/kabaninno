import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { sitePath, urlFor, VIEWPORTS } from '../support/env';
import { waitForFlightSettled, waitForScene, withoutWebGL } from '../support/scene';
import { categories, categoryName, localized, paths, ui } from '../support/site';

/**
 * HTML motion around route changes: no animation on first load (D29), the
 * home hero waits for the camera flight back (N-04) and panels for the flight
 * in (V2-06), the outgoing UI fades out (N-03), none of it under reduced
 * motion, and the home error panel recovers (QA C3-1).
 */

const locale = 'pl';
const web = categories[0]!;
const HERO = 'main [data-route-ui]';
const homeUrl = sitePath(localized(locale, paths.home()));

/** Records exit ghosts (`.ui-exit-layer`) added to and removed from <body>. */
async function recordGhosts(page: Page) {
  await page.evaluate(() => {
    type Ghost = { added: number; removed?: number; clean: boolean; inert: boolean };
    const ghosts: Ghost[] = [];
    const live = new Map<Node, Ghost>();
    (window as Window & { __ghosts?: Ghost[] }).__ghosts = ghosts;
    new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement) || !node.classList.contains('ui-exit-layer')) return;
          const ghost = {
            added: performance.now(),
            clean: node.querySelector('[id], [data-scene-overlay], [data-route-ui]') === null,
            inert: node.inert && node.getAttribute('aria-hidden') === 'true',
          };
          ghosts.push(ghost);
          live.set(node, ghost);
        });
        record.removedNodes.forEach((node) => {
          const ghost = live.get(node);
          if (ghost) ghost.removed = performance.now();
        });
      }
    }).observe(document.body, { childList: true });
  });
}

async function readGhosts(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __ghosts?: { added: number; removed?: number; clean: boolean; inert: boolean }[];
        }
      ).__ghosts ?? [],
  );
}

test('the hero is static on the initial load', async ({ page }) => {
  await page.goto(homeUrl);
  const hero = page.locator(HERO);
  await expect(hero).toHaveCSS('opacity', '1');
  await expect(hero).not.toHaveClass(/ui-enter/);
  await expect(hero).not.toHaveAttribute('data-reveal-reason', /.*/);
});

/**
 * Steps JS time (Playwright's fake clock) until `condition` holds: the camera
 * flight and the reveal gates advance by exact steps however slowly software
 * WebGL renders, which makes the flight-timed assertions deterministic.
 */
async function stepUntil(
  page: Page,
  condition: () => Promise<boolean>,
  stepMs: number,
  maxSteps: number,
) {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await condition()) return true;
    await page.clock.runFor(stepMs);
  }
  return condition();
}

const flyingTo = (page: Page, path: string) =>
  page.evaluate(
    (target) =>
      location.pathname === target && document.documentElement.hasAttribute('data-scene-flight'),
    sitePath(localized(locale, path)),
  );

test('the hero waits for the flight home and reveals on its progress', async ({ page }) => {
  await page.clock.install();
  await page.goto(sitePath(localized(locale, web.path)));
  expect(await waitForScene(page)).toBe(true);
  expect(await waitForFlightSettled(page, { focus: web.path })).toBe(true);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);

  await page.locator('main nav a').first().click(); // breadcrumb "← Universe"
  expect(await stepUntil(page, () => flyingTo(page, paths.home()), 16, 200), 'flight home').toBe(
    true,
  );
  const hero = page.locator(HERO);
  // Early in the flight the hero is still held back.
  await expect(hero).toHaveClass(/ui-enter-pending/);
  const revealed = await stepUntil(
    page,
    async () => (await hero.getAttribute('data-reveal-reason')) !== null,
    50,
    120,
  );
  expect(revealed).toBe(true);
  const reason = await hero.getAttribute('data-reveal-reason');
  test.info().annotations.push({ type: 'reveal reason', description: reason ?? '' });
  expect(['flight', 'flight-end']).toContain(reason);
  await page.clock.resume();
  await expect(hero).not.toHaveClass(/ui-enter-pending/);
  // The 250 ms entrance itself runs in real time; with the fake clock just
  // resumed, software GL renders the backlog of scene frames first, which can
  // hold the CSS animation's start for several seconds (F2 flake, 1 in 3).
  await expect(hero).toHaveCSS('opacity', '1', { timeout: 30_000 });
});

test('a panel waits for the flight to its system, then reveals (V2-06)', async ({ page }) => {
  await page.clock.install();
  await page.goto(homeUrl);
  expect(await waitForScene(page)).toBe(true);
  expect(await waitForFlightSettled(page, { focus: paths.home() })).toBe(true);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);

  await page.locator(`main a[href="${sitePath(localized(locale, web.path))}"]`).click();
  expect(await stepUntil(page, () => flyingTo(page, web.path), 16, 200), 'flight in').toBe(true);
  const panel = page.locator(HERO);
  await expect(panel.locator('h1')).toHaveText(categoryName(locale, web.id));
  await expect(panel).toHaveClass(/ui-enter-pending/);
  const revealed = await stepUntil(
    page,
    async () => (await panel.getAttribute('data-reveal-reason')) !== null,
    50,
    120,
  );
  expect(revealed).toBe(true);
  expect(['flight', 'flight-end']).toContain(await panel.getAttribute('data-reveal-reason'));
  await page.clock.resume();
  await expect(panel).toHaveCSS('opacity', '1');
});

/*
 * D55 (updated in F1): with the WebGL 2 API present but no context (a
 * blocklisted GPU), the scene chunk may load; the renderer then gives up
 * silently. What matters: no canvas remains and the console stays clean
 * (the fixture's guard fails the test on any console error).
 */
test('without WebGL the site works and the hero returns at once', async ({ page }) => {
  await withoutWebGL(page);
  await page.goto(sitePath(localized(locale, web.path)));
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
  await expect(page.locator('canvas')).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('canvas')).toHaveCount(0);

  await page.locator('main nav a').first().click();
  await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);
  await expect(page.locator(HERO)).toHaveAttribute('data-reveal-reason', 'no-scene');
  await expect(page.locator(HERO)).toHaveCSS('opacity', '1');
});

test('the outgoing UI fades out as a dead ghost', async ({ page }) => {
  await page.goto(homeUrl);
  expect(await waitForScene(page)).toBe(true);
  await recordGhosts(page);

  await page.locator(`main a[href="${sitePath(localized(locale, web.path))}"]`).click();
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
  await page.waitForTimeout(800);

  const ghosts = await readGhosts(page);
  expect(ghosts.length, 'one ghost for the home hero').toBe(1);
  const [ghost] = ghosts;
  expect(ghost!.clean, 'no ids or overlay markers in the ghost').toBe(true);
  expect(ghost!.inert, 'ghost is inert and aria-hidden').toBe(true);
  expect(ghost!.removed, 'ghost removed').toBeDefined();
  // 150 ms fade + a 400 ms fallback timer; software GL can block the main
  // thread for a few hundred ms while the system's shaders compile on entry,
  // which delays both (F2: 949 ms with two workers). Still: never stuck.
  expect(ghost!.removed! - ghost!.added).toBeLessThan(1500);
  await expect(page.locator('.ui-exit-layer')).toHaveCount(0);

  // The panel leaving (back to the universe) fades too, once it has fully
  // entered (a root still playing its entrance is dropped without a ghost).
  await expect(page.locator(HERO)).not.toHaveClass(/ui-enter/);
  await page.goBack();
  await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);
  await page.waitForTimeout(800);
  expect((await readGhosts(page)).length).toBe(2);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no exit ghost and a plain fade for the hero', async ({ page }) => {
    await page.goto(homeUrl);
    expect(await waitForScene(page)).toBe(true);
    await recordGhosts(page);

    await page.locator(`main a[href="${sitePath(localized(locale, web.path))}"]`).click();
    await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
    await page.locator('main nav a').first().click();
    await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);
    await expect(page.locator(HERO)).toHaveAttribute('data-reveal-reason', 'reduced-motion');
    await page.waitForTimeout(500);
    expect(await readGhosts(page)).toEqual([]);
  });
});

test('the home error panel recovers instead of linking to itself (C3-1)', async ({
  page,
  issues,
}) => {
  issues.allow(/e2e: injected reveal failure|The above error occurred/);
  await page.addInitScript(() => {
    const add = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...tokens: string[]) {
      const flags = window as Window & { __e2eBreakReveal?: boolean };
      if (flags.__e2eBreakReveal && tokens.includes('ui-enter-pending')) {
        throw new Error('e2e: injected reveal failure');
      }
      return add.apply(this, tokens);
    };
  });
  await page.goto(sitePath(localized(locale, web.path)));
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
  expect(await waitForScene(page)).toBe(true);

  await page.evaluate(() => {
    (window as Window & { __e2eBreakReveal?: boolean }).__e2eBreakReveal = true;
  });
  await page.locator('main nav a').first().click();
  await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
  await expect(page.locator('main h1')).toHaveText(ui[locale].error.title);

  await page.evaluate(() => {
    (window as Window & { __e2eBreakReveal?: boolean }).__e2eBreakReveal = false;
  });
  const back = page.locator('main').getByRole('button', { name: ui[locale].error.home });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);
  await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
});

test.describe('portrait phone', () => {
  test.use({ ...VIEWPORTS.mobile });

  for (const lang of ['pl', 'uk'] as const) {
    test(`the hero frame does not overflow horizontally (C3-2, ${lang})`, async ({ page }) => {
      await page.goto(sitePath(localized(lang, paths.home())));
      const sizes = await page.locator(HERO).evaluate((frame) => ({
        scrollWidth: frame.scrollWidth,
        clientWidth: frame.clientWidth,
        documentScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
      expect(sizes.documentScroll).toBe(0);
    });
  }

  test('360 px wide: no horizontal scroll and 44 px node targets', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(sitePath(localized('uk', paths.home())));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const heights = await page
      .getByRole('navigation', { name: ui.uk.home.explore })
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    expect(heights.length).toBe(categories.length + 2);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  });
});
