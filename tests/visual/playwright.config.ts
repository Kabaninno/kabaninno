import { defineConfig } from '@playwright/test';
import { chromeUse, staticServer, VIEWPORTS } from '../support/env';

/**
 * Screenshot capture of the key states (run through `npm run screenshots`,
 * which sets SCREENSHOT_LABEL and forwards --only / --viewport).
 */
const server = staticServer(Number(process.env.SCREENSHOT_PORT ?? 4301));

export default defineConfig({
  testDir: '.',
  testMatch: 'capture.spec.ts',
  outputDir: '../../test-results/visual',
  globalSetup: '../support/global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  workers: Number(process.env.SCREENSHOT_WORKERS ?? 3),
  retries: 0,
  reporter: [['list']],
  use: { ...chromeUse(), baseURL: server.origin, locale: 'pl-PL' },
  projects: [
    { name: 'desktop', use: { ...VIEWPORTS.desktop } },
    { name: 'mobile', use: { ...VIEWPORTS.mobile } },
  ],
  webServer: server.webServer,
});
