/**
 * Simple (2D) mode map (D124): nodes and planets are real links, the
 * highlight is shared both ways with the HTML lists, and the motion is CSS
 * only (opacity/transform), off under reduced motion.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { sitePath, urlFor, VIEWPORTS } from '../support/env';
import { withSimpleMode } from '../support/scene';
import { categories, categoryName, localized, paths, serviceTitle, ui } from '../support/site';

const locale = 'pl';
const web = categories[0]!;
const MAP = 'nav[data-simple-map]';
const at = (path: string) => urlFor(localized(locale, path));
const mapLink = (page: Page, path: string) =>
  page.locator(`${MAP} a[href="${sitePath(localized(locale, path))}"]`);
const indexLink = (page: Page, path: string) =>
  page.locator(
    `nav[aria-labelledby="home-explore"] a[href="${sitePath(localized(locale, path))}"]`,
  );

/** Properties animated by running animations inside the simple-mode layers. */
async function simpleAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && target.closest('.simple-map, .simple-sky') !== null;
      })
      .map((animation) => {
        const frames = (animation.effect as KeyframeEffect).getKeyframes();
        return frames.flatMap((frame) =>
          Object.keys(frame).filter(
            (key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key),
          ),
        );
      }),
  );
}

test.describe('simple mode map', () => {
  test.beforeEach(async ({ page }) => {
    await withSimpleMode(page);
  });

  test('every universe node is a link; a system opens its planet map', async ({ page }) => {
    await page.goto(sitePath(localized(locale, paths.home())));
    const map = page.locator(MAP);
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute('aria-label', ui[locale].hud.universeMap);
    await expect(map.locator('a')).toHaveCount(categories.length + 2);
    await expect(mapLink(page, paths.portfolio())).toBeVisible();
    await expect(mapLink(page, paths.configurator())).toBeVisible();

    await mapLink(page, web.path).click();
    await expect(page).toHaveURL(at(web.path));
    await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
    await expect(map).toHaveAttribute('data-simple-map', 'system');
    await expect(map.locator('a')).toHaveCount(web.services.length + 1);
    await expect(mapLink(page, web.path)).toHaveAttribute('aria-current', 'page');

    const planet = web.services[1]!;
    await mapLink(page, planet.path).click();
    await expect(page).toHaveURL(at(planet.path));
    await expect(page.locator('main h1')).toHaveText(serviceTitle(locale, web.id, planet.slug));
    await expect(mapLink(page, planet.path)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('node links have 44 px hit areas and a visible focus ring', async ({ page }) => {
    await page.goto(sitePath(localized(locale, paths.home())));
    const link = mapLink(page, web.path);
    const box = (await link.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await link.focus();
    await expect(link).toHaveCSS('outline-style', 'solid');
  });

  test('the highlight is shared both ways with the home index', async ({ page }) => {
    await page.goto(sitePath(localized(locale, paths.home())));
    await mapLink(page, web.path).hover();
    await expect(indexLink(page, web.path)).toHaveAttribute('data-highlighted', '');
    await expect(page.locator(`${MAP} line.is-lit`).first()).toBeAttached();

    const crm = categories[1]!;
    await indexLink(page, crm.path).hover();
    await expect(mapLink(page, crm.path)).toHaveAttribute('data-highlighted', '');
    await expect(mapLink(page, web.path)).not.toHaveAttribute('data-highlighted', '');
  });

  test('the highlight is shared both ways with the planet list of a system', async ({ page }) => {
    await page.goto(sitePath(localized(locale, web.path)));
    const planet = web.services[0]!;
    const card = page.locator(`main a[href="${sitePath(localized(locale, planet.path))}"]`);
    await mapLink(page, planet.path).hover();
    await expect(card).toHaveAttribute('data-highlighted', '');
    await card.hover();
    await expect(mapLink(page, planet.path)).toHaveAttribute('data-highlighted', '');
  });

  test('motion is CSS opacity/transform only', async ({ page }) => {
    await page.goto(sitePath(localized(locale, paths.home())));
    const animations = await simpleAnimations(page);
    expect(animations.length).toBeGreaterThan(0);
    for (const properties of animations) {
      for (const property of properties) expect(['opacity', 'transform']).toContain(property);
    }
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('no running animations, links still work', async ({ page }) => {
      await page.goto(sitePath(localized(locale, paths.home())));
      await expect(page.locator(MAP)).toBeVisible();
      expect(await simpleAnimations(page)).toEqual([]);
      await mapLink(page, web.path).click();
      await expect(page).toHaveURL(at(web.path));
    });
  });

  test.describe('phones', () => {
    test.use({ ...VIEWPORTS.mobile });

    test('the map sits above the sheet and its planets are tappable', async ({ page }) => {
      await page.goto(sitePath(localized(locale, web.path)));
      const planet = web.services[2]!;
      const link = mapLink(page, planet.path);
      await expect(link).toBeVisible();
      const sheet = (await page.locator('main [data-route-ui]').boundingBox())!;
      const box = (await link.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(sheet.y + 1);
      await link.tap();
      await expect(page).toHaveURL(at(planet.path));
    });
  });
});
