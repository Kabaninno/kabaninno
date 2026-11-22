/**
 * Final block F1, UI side: simple (2D) mode, the loading indicator, the
 * first-visit intro, SEO extras and the mobile fixes.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { builtSiteUrl, sitePath, VIEWPORTS } from '../support/env';
import { CANVAS, waitForScene, withSimpleMode, withoutWebGL2Api } from '../support/scene';
import { categories, categoryName, localized, paths, ui } from '../support/site';

const locale = 'pl';
const first = categories[0]!;
const planet = first.services[0]!;
const homeUrl = sitePath(localized(locale, paths.home()));
const HERO = 'main [data-route-ui]';
// The HUD's compact switch (the mobile menu's row variant has a visible label instead).
const HUD_SWITCH = 'header [role="switch"][aria-label]';

const simpleAttribute = (page: Page) =>
  page.evaluate(() => document.documentElement.hasAttribute('data-simple'));

/** Records whether `html[data-simple]` was already set when <body> was created (before first paint). */
async function recordSimpleBeforeBody(page: Page) {
  await page.addInitScript(() => {
    const record = window as Window & { __simpleBeforeBody?: boolean };
    new MutationObserver((records, observer) => {
      for (const item of records) {
        for (const node of item.addedNodes) {
          if (node.nodeName === 'BODY') {
            record.__simpleBeforeBody = document.documentElement.hasAttribute('data-simple');
            observer.disconnect();
          }
        }
      }
      // Init scripts run before <html> exists: watch the whole document.
    }).observe(document, { childList: true, subtree: true });
  });
}

test.describe('simple (2D) mode', () => {
  test('a stored choice applies before the first paint and keeps the 3D layer out', async ({
    page,
  }) => {
    await withSimpleMode(page);
    await recordSimpleBeforeBody(page);
    await page.goto(homeUrl);
    expect(
      await page.evaluate(
        () => (window as Window & { __simpleBeforeBody?: boolean }).__simpleBeforeBody,
      ),
    ).toBe(true);
    await expect(page.locator('.simple-sky')).toBeVisible();
    // The 2D map (D124) replaced the static constellation.
    await expect(page.locator('nav[data-simple-map] a').first()).toBeVisible();
    await expect(page.locator(HUD_SWITCH)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(HERO)).toHaveCSS('opacity', '1');
    await page.waitForTimeout(1500);
    await expect(page.locator('canvas')).toHaveCount(0);
    // The loading indicator never shows in simple mode.
    await expect(page.locator('[data-boot-progress]')).toHaveCSS('opacity', '0');
  });

  test('the HUD switch turns the 3D layer off and on, and remembers it', async ({ page }) => {
    await page.goto(homeUrl);
    expect(await waitForScene(page)).toBe(true);
    const toggle = page.locator(HUD_SWITCH);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(toggle).toHaveAccessibleName(ui[locale].hud.simpleMode);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(CANVAS)).toHaveCount(0);
    expect(await simpleAttribute(page)).toBe(true);
    await expect(page.locator('.simple-sky')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('kabaninno.simpleMode.v1'))).toBe('true');

    await page.reload();
    await expect(page.locator(HUD_SWITCH)).toHaveAttribute('aria-checked', 'true');
    await page.waitForTimeout(1000);
    await expect(page.locator('canvas')).toHaveCount(0);

    await page.locator(HUD_SWITCH).click();
    await expect(page.locator(HUD_SWITCH)).toHaveAttribute('aria-checked', 'false');
    expect(await waitForScene(page)).toBe(true);
    expect(await simpleAttribute(page)).toBe(false);
    await expect(page.locator('.simple-sky')).toBeHidden();
  });

  test('without the WebGL 2 API it is automatic and the switch explains why', async ({ page }) => {
    await withoutWebGL2Api(page);
    await page.goto(sitePath(localized(locale, first.path)));
    await expect(page.locator('main h1')).toHaveText(categoryName(locale, first.id));
    expect(await simpleAttribute(page)).toBe(true);
    const toggle = page.locator(HUD_SWITCH);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(toggle).toHaveAttribute('aria-disabled', 'true');
    await expect(toggle).toHaveAccessibleDescription(ui[locale].hud.simpleModeForced);
    // aria-disabled keeps it focusable; Playwright treats it as disabled, hence `force`.
    await toggle.click({ force: true });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Panels and the hero never wait for flights (D44/D60).
    await page.locator('main nav a').first().click();
    await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);
    await expect(page.locator(HERO)).toHaveAttribute('data-reveal-reason', 'no-scene');
    await expect(page.locator(HERO)).toHaveCSS('opacity', '1');
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test.describe('phones', () => {
    test.use({ ...VIEWPORTS.mobile });

    test('the switch is in the mobile menu', async ({ page }) => {
      await page.goto(homeUrl);
      await page.locator('header button[aria-haspopup="dialog"]').click();
      const toggle = page.locator('dialog[open] [role="switch"]');
      await expect(toggle).toHaveAccessibleName(ui[locale].hud.simpleMode);
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator(CANVAS)).toHaveCount(0);
    });
  });
});

test.describe('loading indicator', () => {
  test('fills while the scene boots and fades out when it is ready', async ({ page }) => {
    await page.goto(homeUrl);
    const indicator = page.locator('[data-boot-progress]');
    await expect(indicator).toBeAttached();
    await expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(await waitForScene(page)).toBe(true);
    await expect(indicator).toHaveAttribute('data-boot-progress', '100', { timeout: 30_000 });
    await expect(indicator).toHaveCSS('opacity', '0');
  });
});

test.describe('intro flight', () => {
  test.use({ introSeen: false });

  test('plays on every fresh load, can be skipped with Esc, and the hero comes back', async ({
    page,
  }) => {
    await page.goto(homeUrl);
    const skip = page.locator('[data-intro-skip]');
    const playing = await skip
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!playing, 'the scene did not start the intro (no WebGL in this run?)');

    await expect(skip).toHaveAccessibleName(new RegExp(ui[locale].hud.skipIntro));
    expect(
      await page.evaluate(() => document.documentElement.hasAttribute('data-intro-active')),
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(skip).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${homeUrl}$`));
    await expect(page.locator(HERO)).toHaveCSS('opacity', '1');
    // Nothing is remembered: the next fresh load plays it again (D140).
    expect(await page.evaluate(() => localStorage.getItem('kabaninno.intro.v2'))).toBeNull();

    await page.reload();
    await expect(skip).toBeVisible({ timeout: 30_000 });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('never plays', async ({ page }) => {
      await page.goto(homeUrl);
      expect(await waitForScene(page)).toBe(true);
      await page.waitForTimeout(4000);
      await expect(page.locator('[data-intro-skip]')).toHaveCount(0);
    });
  });

  test('never plays on a deep link', async ({ page }) => {
    await page.goto(sitePath(localized(locale, first.path)));
    expect(await waitForScene(page)).toBe(true);
    await page.waitForTimeout(4000);
    await expect(page.locator('[data-intro-skip]')).toHaveCount(0);
  });
});

test.describe('SEO extras', () => {
  test('home carries JSON-LD and a per-locale Open Graph image that exists', async ({
    page,
    request,
  }) => {
    for (const code of ['pl', 'uk'] as const) {
      await page.goto(sitePath(localized(code, paths.home())));
      const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
      const data = JSON.parse(jsonLd ?? '{}') as { '@graph': { '@type': string; name?: string }[] };
      expect(data['@graph'].find((node) => node['@type'] === 'Organization')?.name).toBe(
        'KABANINNO',
      );
      // Absolute URLs use the build's public site URL (never localhost, D123).
      const site = builtSiteUrl();
      expect(site).not.toMatch(/localhost|127\.0\.0\.1/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        `${site}/og/${code}.png`,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${site}/${code}/`,
      );
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
        'content',
        code === 'pl' ? 'pl_PL' : 'uk_UA',
      );
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
      const response = await request.get(sitePath(`/og/${code}.png`));
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });
});

test.describe('mobile fixes', () => {
  test.use({ ...VIEWPORTS.mobile });

  test('the configurator opens tall with a sticky footer and the lead on step 1 only', async ({
    page,
  }) => {
    await page.goto(sitePath(localized(locale, paths.configurator())));
    const frame = page.locator('main [data-route-ui]');
    const box = await frame.boundingBox();
    expect(box!.height).toBeGreaterThan(844 * 0.8);
    const next = page.locator('button[type="submit"][form="cfg-form"]');
    await expect(next).toBeInViewport();
    await expect(page.getByText(ui[locale].configurator.lead)).toBeVisible();

    // The industry step is optional: Next moves on to the goals (round 3, D155).
    await next.click();
    await expect(page.locator('#cfg-step-title')).toBeFocused();
    await expect(page.getByText(ui[locale].configurator.lead)).toHaveCount(0);
    await expect(next).toBeInViewport();
  });

  test('a planet sheet keeps the back pill and leaves the current crumb to screen readers', async ({
    page,
  }) => {
    await page.goto(sitePath(localized(locale, planet.path)));
    const crumbs = page.getByRole('navigation', { name: ui[locale].common.breadcrumbs });
    await expect(crumbs.locator('a').first()).toBeVisible();
    const current = crumbs.locator('[aria-current="page"]');
    await expect(current).toBeAttached();
    const size = await current.evaluate((element) => {
      const rect = element.closest('li')!.getBoundingClientRect();
      return rect.width * rect.height;
    });
    expect(size).toBeLessThanOrEqual(1);
  });

  test('landscape phones get a side panel and 44 px HUD targets', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await page.goto(sitePath(localized(locale, planet.path)));
    const frame = page.locator('main [data-route-ui]');
    const box = (await frame.boundingBox())!;
    expect(box.width).toBeLessThan(740 * 0.7);
    expect(box.x + box.width).toBeGreaterThan(700);
    await expect(page.locator('[data-sheet-handle]')).toBeHidden();
    for (const target of await page.locator('header a, header button').all()) {
      if (!(await target.isVisible())) continue;
      const rect = (await target.boundingBox())!;
      expect(
        rect.height,
        await target.evaluate((el) => el.outerHTML.slice(0, 80)),
      ).toBeGreaterThanOrEqual(44);
    }
  });
});
