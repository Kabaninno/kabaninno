import { expect, test } from '../support/fixtures';
import { escapeRegExp, sitePath, urlFor } from '../support/env';
import { documentMark, markDocument, waitForScene } from '../support/scene';
import { categories, LOCALES, localized, paths, ui } from '../support/site';

/**
 * What a static host has to get right without a server: the root redirect,
 * the single 404.html at any depth, and locale switching that keeps the
 * query string and hash.
 */

test.describe('root redirect', () => {
  test('/ redirects to /pl/ and keeps query and hash', async ({ page }) => {
    await page.goto(`${sitePath('/')}?utm_source=e2e&x=1#explore`);
    await expect(page).toHaveURL(
      new RegExp(`${escapeRegExp(sitePath('/pl/'))}\\?utm_source=e2e&x=1#explore$`),
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.locator('main h1')).toHaveText(ui.pl.home.title);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the meta refresh still lands on /pl/', async ({ page, issues }) => {
      // With JavaScript off, Chrome cancels the script preloads ("csp").
      issues.allow(/^csp /, 'requestfailed');
      await page.goto(sitePath('/'));
      await expect(page).toHaveURL(urlFor('/pl/'));
      await expect(page.locator('main h1')).toHaveText(ui.pl.home.title);
    });
  });
});

test.describe('404 at any depth', () => {
  const web = categories[0]!;
  const missing = [
    `/pl${web.path}no-such-planet/deeper/still/`,
    '/uk/this-sector-is-empty/',
    '/en/services/no-such-system/',
    '/pl/portfolio/no-such-case/',
    '/xx/',
  ];

  for (const path of missing) {
    test(`unknown ${path} → 404.html`, async ({ page, issues }) => {
      const url = sitePath(path);
      issues.allowNotFound(new RegExp(`${escapeRegExp(url)}$`));
      const response = await page.goto(url);
      expect(response?.status()).toBe(404);
      await expect(page.locator('h1')).toHaveText('404');
      // Styles loaded under the base path (the star layer is position: fixed).
      await expect(page.locator('.starfield-css')).toHaveCSS('position', 'fixed');
      const cards = page.locator('main li[lang]');
      await expect(cards).toHaveCount(LOCALES.length);
      for (const locale of LOCALES) {
        await expect(cards.locator(`a[hreflang="${locale}"]`)).toHaveAttribute(
          'href',
          sitePath(localized(locale, paths.home())),
        );
      }
      await expect(page.locator('canvas')).toHaveCount(0);
    });
  }

  test('a 404 card leads back into the universe', async ({ page, issues }) => {
    const url = sitePath('/uk/a/b/c/d/');
    issues.allowNotFound(new RegExp(`${escapeRegExp(url)}$`));
    await page.goto(url);
    await page.locator('main a[hreflang="uk"]').click();
    await expect(page).toHaveURL(urlFor('/uk/'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await expect(page.locator('main h1')).toHaveText(ui.uk.home.title);
    expect(await waitForScene(page)).toBe(true);
  });
});

test.describe('locale switch', () => {
  test('keeps the query string and the hash (soft navigation)', async ({ page }) => {
    // A neutral parameter: `?add=` is consumed and removed by the configurator (Q-F3-02).
    const query = '?utm_source=e2e';
    await page.goto(`${sitePath(localized('pl', paths.configurator()))}${query}#steps`);
    await expect(page.locator('main h1')).toHaveText(ui.pl.configurator.title);
    const mark = await markDocument(page);

    const switcher = page.getByRole('navigation', { name: ui.pl.hud.language });
    const en = switcher.locator('a[hreflang="en"]');
    // The query-aware links replace the static fallback after hydration.
    await expect(en).toHaveAttribute('href', /utm_source=e2e/);
    await en.click();

    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(sitePath('/en/configurator/'))}\\?`));
    const url = new URL(page.url());
    expect(url.searchParams.get('utm_source')).toBe('e2e');
    expect(url.hash).toBe('#steps');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('main h1')).toHaveText(ui.en.configurator.title);
    expect(await documentMark(page), 'locale switch is a soft navigation').toBe(mark);
    // The canvas remounts with the [locale] segment (D15), but never doubles.
    expect(await waitForScene(page)).toBe(true);
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('switches a deep system page to Ukrainian', async ({ page }) => {
    const crm = categories[1]!;
    await page.goto(sitePath(localized('en', crm.path)));
    const uk = page
      .getByRole('navigation', { name: ui.en.hud.language })
      .locator('a[hreflang="uk"]');
    await uk.click();
    await expect(page).toHaveURL(urlFor(localized('uk', crm.path)));
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });
});
