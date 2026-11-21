import { defineConfig } from '@playwright/test';
import { chromeUse, staticServer } from '../support/env';

/** axe-core audit (run through `npm run audit:a11y`). */
const server = staticServer(Number(process.env.A11Y_PORT ?? 4302));

export default defineConfig({
  testDir: '.',
  testMatch: 'audit.spec.ts',
  outputDir: '../../test-results/a11y',
  globalSetup: '../support/global-setup.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { ...chromeUse(), baseURL: server.origin },
  webServer: server.webServer,
});
