import { expect, test } from '../support/fixtures';
import { sitePath } from '../support/env';
import { CANVAS, waitForScene } from '../support/scene';
import {
  builtProjects,
  categories,
  categoryName,
  LOCALES,
  localized,
  paths,
  projectTitle,
  serviceTitle,
  ui,
  type TestLocale,
} from '../support/site';

/**
 * Every route type opened directly (cold load of the static HTML), sampled
 * across all locales: every category and one service per category, with the
 * locale rotating, plus home / portfolio / configurator in every locale.
 */

interface DeepLink {
  name: string;
  locale: TestLocale;
  path: string;
  heading: string;
}

const links: DeepLink[] = [
  ...LOCALES.flatMap((locale): DeepLink[] => [
    { name: 'home', locale, path: paths.home(), heading: ui[locale].home.title },
    { name: 'portfolio', locale, path: paths.portfolio(), heading: ui[locale].portfolio.title },
    {
      name: 'configurator',
      locale,
      path: paths.configurator(),
      heading: ui[locale].configurator.title,
    },
  ]),
  ...categories.flatMap((category, index): DeepLink[] => {
    const locale = LOCALES[index % LOCALES.length]!;
    const serviceLocale = LOCALES[(index + 1) % LOCALES.length]!;
    const service = category.services[index % category.services.length]!;
    return [
      {
        name: `system ${category.id}`,
        locale,
        path: category.path,
        heading: categoryName(locale, category.id),
      },
      {
        name: `planet ${category.id}/${service.slug}`,
        locale: serviceLocale,
        path: service.path,
        heading: serviceTitle(serviceLocale, category.id, service.slug),
      },
    ];
  }),
  ...builtProjects().map((project, index): DeepLink => {
    const locale = LOCALES[index % LOCALES.length]!;
    return {
      name: `project ${project.slug}`,
      locale,
      path: project.path,
      heading: projectTitle(locale, project.slug),
    };
  }),
];

for (const link of links) {
  test(`deep link: ${link.name} (${link.locale})`, async ({ page }) => {
    const url = sitePath(localized(link.locale, link.path));
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(200);

    await expect(page.locator('html')).toHaveAttribute('lang', link.locale);
    await expect(page.locator('main h1')).toHaveText(link.heading);
    await expect(page.locator('a[href="#main"]')).toHaveCount(1);
    await expect(page.locator('header nav').first()).toBeVisible();

    expect(await waitForScene(page), 'scene canvas faded in').toBe(true);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator(CANVAS)).toHaveCount(1);
    // URL, content and scene state agree (QA-M2-03, D56).
    await expect(page.locator('html')).toHaveAttribute('data-scene-focus', link.path, {
      timeout: 20_000,
    });
  });
}
