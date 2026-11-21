import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ROOT, sitePath, VIEWPORTS, type ViewportName } from '../support/env';
import { sceneFocusFor, waitForFlightSettled, waitForFonts, waitForScene } from '../support/scene';
import { categories, localized, paths, ui, type TestLocale } from '../support/site';

/**
 * axe-core audit of the key routes in pl and uk, desktop and mobile, written
 * as one JSON summary for perf-a11y-auditor (`npm run audit:a11y`).
 * Violations do not fail the run unless A11Y_STRICT=1 (then any serious or
 * critical violation does).
 */

const OUT = process.env.A11Y_OUT ?? join(ROOT, 'reports', 'perf-a11y', 'axe-summary.json');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const LOCALES: TestLocale[] = ['pl', 'uk'];
const VIEWPORT_NAMES: ViewportName[] = ['desktop', 'mobile'];

interface Route {
  name: string;
  path: (locale: TestLocale) => string;
  status?: number;
  scene?: boolean;
  viewports?: ViewportName[];
  /** Before the page loads (storage seeds). */
  init?: (page: Page) => Promise<void>;
  prepare?: (page: Page, locale: TestLocale) => Promise<void>;
}

/** A complete configurator draft (ids from content and `content/configurator.ts`). */
const DRAFT = {
  types: ['web', 'crm'],
  features: ['web/online-stores', 'web/seo', 'crm/custom-crm'],
  business: { industry: 'retail', size: '2-10', hasWebsite: 'yes', hasCrm: 'no' },
  budget: '15k-40k',
  timeline: '1-3-months',
  contact: { name: 'Łucja Żółkiewska', comment: 'Sklep z integracją CRM.' },
};

/** Seeds localStorage before the page loads. */
function seed(key: string, value: unknown) {
  return async (page: Page) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
      key,
      JSON.stringify(value),
    ] as const);
  };
}

const web = categories[0]!;
const ROUTES: Route[] = [
  { name: 'home', path: (l) => localized(l, paths.home()) },
  { name: 'system', path: (l) => localized(l, web.path) },
  { name: 'planet', path: (l) => localized(l, web.services[0]!.path) },
  { name: 'portfolio', path: (l) => localized(l, paths.portfolio()) },
  { name: 'configurator', path: (l) => localized(l, paths.configurator()) },
  { name: '404', path: (l) => `/${l}/this-sector-is-empty/`, status: 404, scene: false },
  // States that hid the F3 blockers (A-F3-06): a non-empty request (HUD
  // link name), the wizard summary (definition list) and validation errors.
  {
    name: 'home-request',
    path: (l) => localized(l, paths.home()),
    init: seed('kabaninno.request.v1', {
      v: 1,
      items: [`${web.id}/${web.services[0]!.slug}`, `${web.id}/${web.services[1]!.slug}`],
    }),
  },
  {
    name: 'wizard-summary',
    path: (l) => localized(l, paths.configurator()),
    init: seed('kabaninno.configurator.v1', { v: 1, step: 'summary', draft: DRAFT }),
  },
  {
    name: 'wizard-errors',
    path: (l) => localized(l, paths.configurator()),
    init: seed('kabaninno.configurator.v1', {
      v: 1,
      step: 'business',
      draft: { ...DRAFT, business: { industry: null, size: null, hasWebsite: null, hasCrm: null } },
    }),
    prepare: async (page, locale) => {
      await page
        .locator('main [data-route-ui]')
        .getByRole('button', { name: ui[locale].configurator.nav.next })
        .click();
      await page.locator('[aria-invalid="true"]').first().waitFor();
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'home-menu-open',
    path: (l) => localized(l, paths.home()),
    viewports: ['mobile'],
    prepare: async (page) => {
      await page.locator('header button[aria-haspopup="dialog"]').click();
      await page.locator('dialog[open]').waitFor();
      await page.waitForTimeout(300);
    },
  },
];

function axeVersion(): string {
  try {
    const pkg = join(ROOT, 'node_modules', 'axe-core', 'package.json');
    return (JSON.parse(readFileSync(pkg, 'utf8')) as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

test('axe audit of key routes', async ({ browser, baseURL }) => {
  test.setTimeout(10 * 60_000);
  const results = [];
  const byImpact: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };

  for (const viewport of VIEWPORT_NAMES) {
    const context = await browser.newContext({ ...VIEWPORTS[viewport], baseURL, locale: 'pl-PL' });
    // A returning visitor: the first-visit intro (D94) would hide the home hero.
    await context.addInitScript(() => {
      try {
        localStorage.setItem('kabaninno.intro.v1', 'true');
      } catch {
        // ignore
      }
    });
    for (const route of ROUTES) {
      if (route.viewports && !route.viewports.includes(viewport)) continue;
      for (const locale of LOCALES) {
        const page = await context.newPage();
        await route.init?.(page);
        const url = sitePath(route.path(locale));
        const response = await page.goto(url);
        if (route.scene !== false) {
          await waitForScene(page);
          await waitForFlightSettled(page, { focus: sceneFocusFor(route.path(locale)) });
        }
        await waitForFonts(page);
        await page.waitForTimeout(400);
        await route.prepare?.(page, locale);

        const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const violations = axe.violations.map((violation) => {
          byImpact[violation.impact ?? 'minor'] = (byImpact[violation.impact ?? 'minor'] ?? 0) + 1;
          return {
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            helpUrl: violation.helpUrl,
            nodes: violation.nodes.length,
            targets: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
            summary: violation.nodes[0]?.failureSummary ?? '',
          };
        });
        results.push({
          route: route.name,
          locale,
          viewport,
          url,
          status: response?.status() ?? 0,
          expectedStatus: route.status ?? 200,
          violations,
          incomplete: axe.incomplete.map((item) => ({
            id: item.id,
            impact: item.impact,
            nodes: item.nodes.length,
          })),
          passes: axe.passes.length,
        });
        console.log(
          `[axe] ${viewport.padEnd(7)} ${locale} ${route.name.padEnd(15)} ` +
            (violations.length === 0
              ? 'no violations'
              : violations.map((v) => `${v.id}(${v.impact}, ${v.nodes})`).join(', ')),
        );
        await page.close();
      }
    }
    await context.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: `${baseURL}${sitePath('/')}`,
    axeVersion: axeVersion(),
    tags: TAGS,
    totals: {
      scans: results.length,
      scansWithViolations: results.filter((result) => result.violations.length > 0).length,
      violations: results.reduce((sum, result) => sum + result.violations.length, 0),
      byImpact,
    },
    results,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\n[axe] ${results.length} scans, summary written to ${OUT}`);

  if (process.env.A11Y_STRICT === '1') {
    expect(byImpact.critical! + byImpact.serious!, 'serious or critical violations').toBe(0);
  }
});
