import { expect, test } from '../support/fixtures';
import { sitePath } from '../support/env';

/**
 * Self-check of the browser guard (tests/support/fixtures.ts): the
 * `test.fail()` tests are EXPECTED to fail, proving that a console error, an
 * uncaught exception, a 404 subresource or a three.js warning really fails an
 * e2e test; the last one checks the allowlist.
 */

test('the guard fails a test on a console error', async ({ page }) => {
  test.fail();
  await page.goto(sitePath('/pl/'));
  await page.evaluate(() => console.error('e2e: guard self-check'));
});

test('the guard fails a test on an uncaught page error', async ({ page }) => {
  test.fail();
  await page.goto(sitePath('/pl/'));
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('e2e: guard self-check');
    }, 0);
  });
  await page.waitForTimeout(200);
});

test('the guard fails a test on a 404 subresource', async ({ page }) => {
  test.fail();
  await page.goto(sitePath('/pl/'));
  const status = await page.evaluate(
    async (url) => (await fetch(url)).status,
    sitePath('/missing.js'),
  );
  expect(status).toBe(404);
});

test('the guard fails a test on a three.js console warning', async ({ page }) => {
  test.fail();
  await page.goto(sitePath('/pl/'));
  await page.evaluate(() => console.warn('THREE.WebGLRenderer: e2e guard self-check'));
});

test('an allowed warning does not fail the test', async ({ page, issues }) => {
  issues.allow(/e2e allowed warning/, 'warning');
  await page.goto(sitePath('/pl/'));
  await page.evaluate(() => console.warn('THREE.Material: e2e allowed warning'));
});
