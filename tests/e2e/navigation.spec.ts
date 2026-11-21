import type { Page, Request } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { sitePath, urlFor } from '../support/env';
import { CANVAS, documentMark, markDocument, sceneInstance, waitForScene } from '../support/scene';
import { categories, categoryName, localized, paths, serviceTitle, ui } from '../support/site';

/**
 * Client-side navigation inside the persistent shell: no document reloads,
 * one canvas that survives every route change, Back/Forward restore both the
 * URL and the content.
 */

const locale = 'pl';
const web = categories[0]!;
const crm = categories[1]!;
const firstService = web.services[0]!;

/** Counts top-level document requests after the call (soft navigations make none). */
function countDocumentRequests(page: Page): () => number {
  let count = 0;
  const onRequest = (request: Request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) count += 1;
  };
  page.on('request', onRequest);
  return () => count;
}

/** Link inside <main> pointing at a locale-less path. */
function mainLink(page: Page, path: string) {
  return page.locator(`main a[href="${sitePath(localized(locale, path))}"]`).first();
}

async function expectShellIntact(page: Page, mark: string, instance: string | null) {
  expect(await documentMark(page), 'same document (soft navigation)').toBe(mark);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await sceneInstance(page), 'canvas not remounted').toBe(instance);
}

/** The camera settled on the scene state of `path` (QA-M2-03, D56). */
async function expectSceneAt(page: Page, path: string) {
  await expect(page.locator('html')).toHaveAttribute('data-scene-focus', path, {
    timeout: 20_000,
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-scene-flight', /.*/, {
    timeout: 20_000,
  });
}

test('soft navigation keeps the document and the canvas', async ({ page }) => {
  await page.goto(sitePath(localized(locale, paths.home())));
  expect(await waitForScene(page)).toBe(true);
  const mark = await markDocument(page);
  const instance = await sceneInstance(page);
  expect(instance).toBeTruthy();
  const documents = countDocumentRequests(page);

  // Home → system (index link).
  await mainLink(page, web.path).click();
  await expect(page).toHaveURL(urlFor(localized(locale, web.path)));
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
  await expectShellIntact(page, mark, instance);
  await expectSceneAt(page, web.path);

  // System → planet (panel link).
  await mainLink(page, firstService.path).click();
  await expect(page).toHaveURL(urlFor(localized(locale, firstService.path)));
  await expect(page.locator('main h1')).toHaveText(serviceTitle(locale, web.id, firstService.slug));
  await expectShellIntact(page, mark, instance);

  // HUD → portfolio, configurator, then the wordmark home.
  await page
    .locator(`header a[href="${sitePath(localized(locale, paths.portfolio()))}"]:visible`)
    .click();
  await expect(page).toHaveURL(urlFor(localized(locale, paths.portfolio())));
  await expect(page.locator('main h1')).toHaveText(ui[locale].portfolio.title);
  await expectShellIntact(page, mark, instance);
  await expectSceneAt(page, paths.portfolio());

  await page
    .locator(`header nav a[href="${sitePath(localized(locale, paths.configurator()))}"]:visible`)
    .click();
  await expect(page).toHaveURL(urlFor(localized(locale, paths.configurator())));
  await expect(page.locator('main h1')).toHaveText(ui[locale].configurator.title);
  await expectShellIntact(page, mark, instance);
  await expectSceneAt(page, paths.configurator());

  await page
    .locator(`header a[href="${sitePath(localized(locale, paths.home()))}"]:visible`)
    .click();
  await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
  await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);
  await expectShellIntact(page, mark, instance);
  await expectSceneAt(page, paths.home());

  expect(documents(), 'no document requests during soft navigation').toBe(0);
});

test('Back and Forward restore the URL and the content', async ({ page }) => {
  await page.goto(sitePath(localized(locale, paths.home())));
  expect(await waitForScene(page)).toBe(true);
  const mark = await markDocument(page);
  const instance = await sceneInstance(page);

  await mainLink(page, crm.path).click();
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, crm.id));
  const crmService = crm.services[1] ?? crm.services[0]!;
  await mainLink(page, crmService.path).click();
  const crmServiceTitle = serviceTitle(locale, crm.id, crmService.slug);
  await expect(page.locator('main h1')).toHaveText(crmServiceTitle);

  await page.goBack();
  await expect(page).toHaveURL(urlFor(localized(locale, crm.path)));
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, crm.id));
  await expectSceneAt(page, crm.path);

  await page.goBack();
  await expect(page).toHaveURL(urlFor(localized(locale, paths.home())));
  await expect(page.locator('main h1')).toHaveText(ui[locale].home.title);
  await expectSceneAt(page, paths.home());
  // The hero comes back once the flight home is far enough (or after the fallback).
  await expect(page.locator('main [data-route-ui]')).toHaveAttribute('data-reveal-reason', /.+/, {
    timeout: 8_000,
  });

  await page.goForward();
  await expect(page).toHaveURL(urlFor(localized(locale, crm.path)));
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, crm.id));
  await expectSceneAt(page, crm.path);

  await page.goForward();
  await expect(page).toHaveURL(urlFor(localized(locale, crmService.path)));
  await expect(page.locator('main h1')).toHaveText(crmServiceTitle);
  await expectSceneAt(page, crmService.path);

  await expectShellIntact(page, mark, instance);
});

test('Back from a deep link leaves the site history cleanly', async ({ page }) => {
  // A second entry exists only within the site: Back goes to the previous route.
  await page.goto(sitePath(localized(locale, web.path)));
  expect(await waitForScene(page)).toBe(true);
  await mainLink(page, firstService.path).click();
  await expect(page.locator('main h1')).toHaveText(serviceTitle(locale, web.id, firstService.slug));
  await page.goBack();
  await expect(page).toHaveURL(urlFor(localized(locale, web.path)));
  await expect(page.locator('main h1')).toHaveText(categoryName(locale, web.id));
  await expect(page.locator(CANVAS)).toHaveCount(1);
  await expectSceneAt(page, web.path);
});
