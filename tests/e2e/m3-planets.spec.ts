/**
 * M3 "Planetary systems", UI side.
 *
 * Covers: ←/→ planet switching (push from the system, replace between
 * planets, D16), the swipe on the bottom sheet, the «← Universe» button, the
 * request toggle (state, live region, HUD badge, persistence, no-JS
 * fallback) and the mobile sheet handle.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { sitePath, urlFor, VIEWPORTS } from '../support/env';
import { waitForSceneReady } from '../support/scene';
import { categories, localized, paths, serviceTitle, ui } from '../support/site';

const locale = 'pl';
const crm = categories[1]!;
const services = crm.services;
const first = services[0]!;
const second = services[1]!;
const last = services[services.length - 1]!;
const REQUEST_KEY = 'kabaninno.request.v1';

const at = (path: string) => urlFor(localized(locale, path));
const open = (page: Page, path: string) => page.goto(sitePath(localized(locale, path)));
const historyLength = (page: Page) => page.evaluate(() => history.length);

test.describe('planet switching with ←/→', () => {
  test('from the system → enters the first planet and ← the last (push)', async ({ page }) => {
    await open(page, crm.path);
    await expect(page.locator('main h1')).toBeVisible();
    const length = await historyLength(page);

    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(at(first.path));
    expect(await historyLength(page)).toBe(length + 1);
    await page.goBack();
    await expect(page).toHaveURL(at(crm.path));

    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(at(last.path));
  });

  test('between planets it wraps around and replaces the history entry', async ({ page }) => {
    await open(page, crm.path);
    await page
      .locator(`main a[href="${sitePath(localized(locale, first.path))}"]`)
      .first()
      .click();
    await expect(page).toHaveURL(at(first.path));
    const length = await historyLength(page);

    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(at(second.path));
    await expect(page.locator('main h1')).toHaveText(serviceTitle(locale, crm.id, second.slug));
    await page.keyboard.press('ArrowLeft');
    // Each panel handles one move (its neighbours); wait for the next planet.
    await expect(page).toHaveURL(at(first.path));
    await expect(page.locator('main h1')).toHaveText(serviceTitle(locale, crm.id, first.slug));
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(at(last.path));
    expect(await historyLength(page), 'router.replace').toBe(length);

    // Back returns to the system, not through every planet.
    await page.goBack();
    await expect(page).toHaveURL(at(crm.path));
  });

  test('focus moves to the new planet heading (D61)', async ({ page }) => {
    await open(page, first.path);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(at(second.path));
    await expect(page.locator('main h1')).toBeFocused();
  });

  test('ignored with modifiers and while the Services menu is open', async ({ page }) => {
    await open(page, first.path);
    await expect(page.locator('main h1')).toBeVisible();
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(at(first.path));

    const toggle = page.locator('header button[aria-expanded]:visible').first();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(at(first.path));
  });
});

test.describe('«← Universe» button', () => {
  for (const path of [crm.path, first.path]) {
    test(`is visible and leads home from ${path}`, async ({ page }) => {
      await open(page, path);
      const button = page
        .locator('main nav')
        .first()
        .getByRole('link', { name: ui[locale].common.backToUniverse });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
      await button.click();
      await expect(page).toHaveURL(at(paths.home()));
    });
  }
});

test.describe('request toggle', () => {
  test('adds and removes, announces, shows the HUD badge and persists', async ({ page }) => {
    await open(page, first.path);
    // APG toggle button: the name stays «Dodaj do zapytania», aria-pressed carries the state.
    const toggle = page
      .locator('main')
      .getByRole('button', { name: ui[locale].service.addToRequest, exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAccessibleName(ui[locale].service.addToRequest);
    await expect(page.locator('main [role="status"]')).toContainText(
      serviceTitle(locale, crm.id, first.slug),
    );
    await expect(
      page.locator('main').getByRole('link', { name: ui[locale].service.goToRequest }),
    ).toBeVisible();
    const hudLink = page.locator(
      `header nav a[href="${sitePath(localized(locale, paths.configurator()))}"]:visible`,
    );
    await expect(hudLink).toHaveAccessibleName(new RegExp(`^${ui[locale].hud.configurator}, 1 `));
    expect(await page.evaluate((key) => localStorage.getItem(key), REQUEST_KEY)).toBe(
      JSON.stringify({ v: 1, items: [`${crm.id}/${first.slug}`] }),
    );

    // Survives a reload.
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(hudLink).toHaveAccessibleName(new RegExp(`, 1 `));

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(hudLink).toHaveAccessibleName(ui[locale].hud.configurator);
    expect(await page.evaluate((key) => localStorage.getItem(key), REQUEST_KEY)).toBeNull();
  });

  test('drops stored refs that are no longer services', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify({ v: 1, items: ['web/removed-service'] }));
    }, REQUEST_KEY);
    await open(page, first.path);
    await expect(
      page.locator('main').getByRole('button', { name: ui[locale].service.addToRequest }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), REQUEST_KEY))
      .toBeNull();
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('falls back to the configurator link with ?add=', async ({ page, issues }) => {
      issues.allow(/^csp /, 'requestfailed');
      await open(page, first.path);
      const link = page
        .locator('main')
        .getByRole('link', { name: ui[locale].service.addToRequest });
      const href = await link.getAttribute('href');
      expect(new URL(href!, 'http://x').searchParams.get('add')).toBe(`${crm.id}/${first.slug}`);
    });
  });
});

test.describe('mobile bottom sheet', () => {
  test.use({ ...VIEWPORTS.mobile });

  test('the handle collapses and expands the sheet (tap and keyboard)', async ({ page }) => {
    await open(page, first.path);
    const sheet = page.locator('main [data-route-ui]');
    const handle = page.locator('[data-sheet-handle]');
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    const expanded = (await sheet.boundingBox())!.height;

    await handle.tap();
    await expect(sheet).toHaveAttribute('data-sheet', 'collapsed');
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await sheet.boundingBox())!.height).toBeLessThan(expanded / 2);

    await handle.focus();
    await page.keyboard.press('Enter');
    await expect(sheet).toHaveAttribute('data-sheet', 'expanded');
  });

  test('a collapsed sheet stays collapsed across planet swipes', async ({ page }) => {
    await open(page, first.path);
    // Swipe only once the scene has settled (its boot keeps the main thread busy).
    expect(await waitForSceneReady(page, first.path)).toBe(true);
    await page.locator('[data-sheet-handle]').tap();
    await expect(page.locator('main [data-route-ui]')).toHaveAttribute('data-sheet', 'collapsed');

    await swipe(page, { fromX: 300, toX: 80, y: 760 });
    await expect(page).toHaveURL(at(second.path));
    await expect(page.locator('main [data-route-ui]')).toHaveAttribute('data-sheet', 'collapsed');
    expect(await waitForSceneReady(page, second.path)).toBe(true);

    await swipe(page, { fromX: 80, toX: 300, y: 760 });
    await expect(page).toHaveURL(at(first.path));
  });

  test('a vertical drag inside the sheet scrolls and does not switch planets', async ({ page }) => {
    await open(page, first.path);
    expect(await waitForSceneReady(page, first.path)).toBe(true);
    await swipe(page, { fromX: 200, toX: 210, y: 760, toY: 560 });
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(at(first.path));
  });
});

/** A touch drag through CDP (touchStart → moves → touchEnd), which yields pointer events. */
/**
 * A touch flick through CDP with explicit event timestamps (start, +50 ms,
 * +100 ms, end at +120 ms): the swipe's duration is then the gesture's own,
 * not how long a busy main thread (software GL) took to deliver the events,
 * which pushed it past the 700 ms swipe limit (Q-F3-03).
 */
async function swipe(
  page: Page,
  { fromX, toX, y, toY = y }: { fromX: number; toX: number; y: number; toY?: number },
) {
  const cdp = await page.context().newCDPSession(page);
  const start = Date.now() / 1000;
  const at = (fraction: number) => ({
    x: fromX + (toX - fromX) * fraction,
    y: y + (toY - y) * fraction,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [at(0)],
    timestamp: start,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [at(0.5)],
    timestamp: start + 0.05,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [at(1)],
    timestamp: start + 0.1,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
    timestamp: start + 0.12,
  });
  await cdp.detach();
}
