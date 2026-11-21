import { defineConfig } from '@playwright/test';
import { chromeUse, staticServer, VIEWPORTS } from './tests/support/env';

/**
 * End-to-end tests against the static export (out/) served under the base
 * path `/kabaninno`, like a GitHub Pages project site.
 *
 *   npm run build:preview && npm run test:e2e     (or: npm run e2e:full)
 *
 * Screenshots and the axe audit have their own configs
 * (tests/visual, tests/a11y) and runners (npm run screenshots / audit:a11y).
 */
const server = staticServer(Number(process.env.E2E_PORT ?? 4300));

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/e2e',
  globalSetup: './tests/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Every test renders the WebGL scene on SwiftShader (CPU): keep it moderate.
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    ...chromeUse(),
    ...VIEWPORTS.desktop,
    baseURL: server.origin,
    locale: 'pl-PL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: server.webServer,
});
