/**
 * M5 "Portfolio", UI side.
 *
 * NOT RUN YET: written under light mode (D57), where e2e, browsers and builds
 * are off. The final block runs this file with the rest of the suite.
 *
 * Most tests need visible cases, i.e. a preview built with drafts:
 *   SHOW_DRAFTS=true npm run build:preview
 * They skip themselves on a production build, where only the "coming soon"
 * test runs.
 */
import type { Page } from '@playwright/test';
import { getAllProjects } from '~/content';
import { expect, test } from '../support/fixtures';
import { escapeRegExp, sitePath, urlFor } from '../support/env';
import { builtProjects, categoryName, localized, paths, projectTitle, ui } from '../support/site';

const locale = 'pl';
const built = builtProjects().map((project) => project.slug);
const cases = getAllProjects().filter((project) => built.includes(project.slug));
const hasCases = cases.length > 0;
const at = (path: string) => urlFor(localized(locale, path));
const open = (page: Page, path: string) => page.goto(sitePath(localized(locale, path)));
const panel = (page: Page) => page.locator('main [data-route-ui]');
/** Case cards: links to /<locale>/portfolio/<slug>/ (not the filter chips). */
const caseLinks = (page: Page) => {
  const base = sitePath(localized(locale, paths.portfolio()));
  return panel(page).locator(`a[href^="${base}"][href$="/"]:not([href="${base}"])`);
};

test.describe('[M5, not yet run] portfolio index', () => {
  test('without published cases: the "coming soon" panel', async ({ page }) => {
    test.skip(hasCases, 'this build contains cases (SHOW_DRAFTS)');
    await open(page, paths.portfolio());
    await expect(panel(page)).toContainText(ui[locale].portfolio.emptyTitle);
    await expect(
      panel(page).getByRole('navigation', { name: ui[locale].portfolio.filterLabel }),
    ).toHaveCount(0);
  });

  test('the category filter lives in the URL and replaces the history entry', async ({ page }) => {
    test.skip(!hasCases, 'needs a SHOW_DRAFTS build');
    const category = cases[0]!.categories[0]!;
    const expected = cases.filter((project) => project.categories.includes(category));
    await open(page, paths.portfolio());
    const filter = panel(page).getByRole('navigation', { name: ui[locale].portfolio.filterLabel });
    await expect(
      filter.getByRole('link', { name: ui[locale].portfolio.filterAll }),
    ).toHaveAttribute('aria-current', 'true');
    const length = await page.evaluate(() => history.length);

    const chip = filter.getByRole('link', { name: categoryName(locale, category), exact: true });
    // Plain links: they also work without JavaScript.
    await expect(chip).toHaveAttribute(
      'href',
      new RegExp(`\\?category=${escapeRegExp(category)}$`),
    );
    await chip.click();
    await expect(page).toHaveURL(new RegExp(`\\?category=${escapeRegExp(category)}$`));
    await expect(chip).toHaveAttribute('aria-current', 'true');
    await expect(caseLinks(page)).toHaveCount(expected.length);
    await expect(panel(page).locator('[role="status"]').first()).not.toBeEmpty();
    expect(await page.evaluate(() => history.length), 'router.replace').toBe(length);
  });

  test('Back from a case restores the filter', async ({ page }) => {
    test.skip(!hasCases, 'needs a SHOW_DRAFTS build');
    const category = cases[0]!.categories[0]!;
    await page.goto(`${sitePath(localized(locale, paths.portfolio()))}?category=${category}`);
    const first = cases.find((project) => project.categories.includes(category))!;
    await panel(page)
      .locator(`a[href="${sitePath(localized(locale, paths.project(first.slug)))}"]`)
      .click();
    await expect(page).toHaveURL(at(paths.project(first.slug)));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`\\?category=${escapeRegExp(category)}$`));
    await expect(
      panel(page).getByRole('link', { name: categoryName(locale, category), exact: true }),
    ).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('[M5, not yet run] case page', () => {
  test('sections, gallery with base path, «← Portfolio» and prev/next (replace)', async ({
    page,
  }) => {
    test.skip(cases.length < 2, 'needs a SHOW_DRAFTS build with at least two cases');
    const project = cases.find((item) => item.gallery.length > 0) ?? cases[0]!;
    await open(page, paths.project(project.slug));
    await expect(panel(page).locator('h1')).toHaveText(projectTitle(locale, project.slug));
    for (const heading of [
      ui[locale].portfolio.task,
      ui[locale].portfolio.solution,
      ui[locale].portfolio.result,
    ]) {
      await expect(panel(page).getByRole('heading', { name: heading })).toBeVisible();
    }

    const images = panel(page).locator('section[aria-labelledby="project-gallery"] img');
    await expect(images).toHaveCount(project.gallery.length);
    const first = images.first();
    await expect(first).toHaveAttribute('src', sitePath(project.gallery[0]!.src));
    await expect(first).toHaveAttribute('loading', 'lazy');
    await expect(first).toHaveAttribute('width', String(project.gallery[0]!.width));
    expect(
      await first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    ).toBe(true);

    const length = await page.evaluate(() => history.length);
    const siblings = panel(page).getByRole('navigation', {
      name: ui[locale].portfolio.siblingsNav,
    });
    await siblings.getByRole('link', { name: new RegExp(ui[locale].portfolio.next) }).click();
    await expect(page).not.toHaveURL(at(paths.project(project.slug)));
    expect(await page.evaluate(() => history.length)).toBe(length);

    await panel(page).locator('nav a').first().click(); // «← Portfolio»
    await expect(page).toHaveURL(at(paths.portfolio()));
  });

  test('mockup demos are interactive', async ({ page }) => {
    const chat = cases.find(
      (project) => project.demo?.type === 'mockup' && project.demo.variant === 'telegram-chat',
    );
    test.skip(!chat, 'needs a SHOW_DRAFTS build with the telegram-chat mockup');
    await open(page, paths.project(chat!.slug));
    const demo = panel(page).locator('section[aria-labelledby="project-demo"]');
    await demo
      .getByRole('button', { name: ui[locale].portfolio.mockups.chat.options.hours })
      .click();
    await expect(demo.getByRole('log')).toContainText(
      ui[locale].portfolio.mockups.chat.replies.hours,
    );
  });

  test('the live iframe loads only on request, sandboxed and lazy', async ({ page, issues }) => {
    const live = cases.find((project) => project.demo?.type === 'iframe');
    test.skip(!live, 'needs a SHOW_DRAFTS build with an iframe demo');
    // The external page may be unreachable on CI; its own requests are not ours to check.
    issues.allow(/example\.com/);
    await open(page, paths.project(live!.slug));
    const demo = panel(page).locator('section[aria-labelledby="project-demo"]');
    await expect(demo.locator('iframe')).toHaveCount(0);
    await demo.getByRole('button', { name: ui[locale].portfolio.demoLoad }).click();
    const frame = demo.locator('iframe');
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(frame).toHaveAttribute('loading', 'lazy');
    await expect(frame).toBeFocused();
    await expect(
      demo.getByRole('link', { name: new RegExp(ui[locale].portfolio.demoOpen) }),
    ).toHaveAttribute('target', '_blank');
  });
});
