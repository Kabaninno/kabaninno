import { expect, test } from '../support/fixtures';
import { sitePath, urlFor, VIEWPORTS } from '../support/env';
import { waitForScene } from '../support/scene';
import { categories, categoryName, localized, paths, serviceTitle, ui } from '../support/site';

/**
 * Keyboard access to the universe: all seven nodes are links on the home
 * page, and Esc climbs to the parent scene state (D27).
 */

const locale = 'pl';
const web = categories[0]!;
const service = web.services[1] ?? web.services[0]!;

test('all seven universe nodes are reachable with Tab from the home index', async ({ page }) => {
  await page.goto(sitePath(localized(locale, paths.home())));
  const index = page.getByRole('navigation', { name: ui[locale].home.explore });
  await expect(index).toBeVisible();
  await expect(index.getByText(ui[locale].home.explore)).toBeVisible();

  const expected = [
    ...categories.map((category) => category.path),
    paths.portfolio(),
    paths.configurator(),
  ].map((path) => sitePath(localized(locale, path)));
  await expect(index.locator('a')).toHaveCount(expected.length);

  const reached = new Set<string>();
  for (let step = 0; step < 40 && reached.size < expected.length; step += 1) {
    await page.keyboard.press('Tab');
    const href = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.closest('nav[aria-labelledby="home-explore"]')
        ? active.getAttribute('href')
        : null;
    });
    if (href) reached.add(href);
  }
  expect([...reached].sort()).toEqual([...expected].sort());

  // Enter on a focused node opens its system.
  await index.locator(`a[href="${sitePath(localized(locale, web.path))}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(urlFor(localized(locale, web.path)));
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
});

test('focus follows keyboard navigation: heading forward, node link back (A-01)', async ({
  page,
}) => {
  await page.goto(sitePath(localized(locale, paths.home())));
  expect(await waitForScene(page)).toBe(true);
  const index = page.getByRole('navigation', { name: ui[locale].home.explore });
  const node = index.locator(`a[href="${sitePath(localized(locale, web.path))}"]`);
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(urlFor(localized(locale, web.path)));
  const heading = page.locator('main h1');
  await expect(heading).toHaveText(categoryName(locale, web.id));
  await expect(heading).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
  await expect(node).toBeFocused();
});

test('the skip link lands on the visible page heading (A-02)', async ({ page }) => {
  await page.goto(sitePath(localized(locale, web.path)));
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: ui[locale].common.skipToContent });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  const heading = page.locator('main h1');
  await expect(heading).toBeFocused();
  const box = await heading.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(20);
  // The next Tab continues inside the content panel, not back at the top.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('main') !== null)).toBe(true);
});

test.describe('Esc → parent', () => {
  test('from a deep-linked planet: pushes the system, then the universe', async ({ page }) => {
    await page.goto(sitePath(localized(locale, service.path)));
    expect(await waitForScene(page)).toBe(true);
    const length = await page.evaluate(() => history.length);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(urlFor(localized(locale, web.path)));
    await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
    expect(await page.evaluate(() => history.length)).toBe(length + 1);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
    await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);

    // The universe has no parent: Esc is a no-op there.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
  });

  test('goes back when the previous entry is the parent', async ({ page }) => {
    await page.goto(sitePath(localized(locale, paths.home())));
    expect(await waitForScene(page)).toBe(true);
    await page.locator(`main a[href="${sitePath(localized(locale, web.path))}"]`).click();
    await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
    await page
      .locator(`main a[href="${sitePath(localized(locale, service.path))}"]`)
      .first()
      .click();
    await expect(page.locator('main h1')).toHaveText(serviceTitle(locale, web.id, service.slug));
    const length = await page.evaluate(() => history.length);

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(urlFor(localized(locale, web.path)));
    expect(await page.evaluate(() => history.length), 'history.back(), no new entry').toBe(length);

    // Forward returns to the planet: proof that Esc went back in history.
    await page.goForward();
    await expect(page).toHaveURL(urlFor(localized(locale, service.path)));
  });

  test('portfolio and configurator lead back to the universe', async ({ page }) => {
    for (const path of [paths.portfolio(), paths.configurator()]) {
      await page.goto(sitePath(localized(locale, path)));
      await expect(page.locator('main h1')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
    }
  });

  test('an Esc consumed by the Services menu does not navigate', async ({ page }) => {
    await page.goto(sitePath(localized(locale, web.path)));
    const toggle = page.locator('header button[aria-expanded]:visible').first();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(urlFor(localized(locale, web.path)));

    // A second Esc (menu closed) climbs to the universe.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
  });

  test.describe('mobile', () => {
    test.use({ ...VIEWPORTS.mobile });

    test('Esc closes the open menu dialog without navigating', async ({ page }) => {
      await page.goto(sitePath(localized(locale, web.path)));
      const open = page.getByRole('button', { name: ui[locale].hud.menuOpen });
      await open.click();
      const dialog = page.locator('dialog[open]');
      await expect(dialog).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await page.waitForTimeout(300);
      await expect(page).toHaveURL(urlFor(localized(locale, web.path)));
      await expect(open).toBeFocused();
    });
  });
});
