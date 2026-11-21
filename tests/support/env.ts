import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LaunchOptions } from '@playwright/test';

/**
 * Shared environment of every Playwright run (e2e, screenshots, a11y audit):
 * the static export in out/ served the way GitHub Pages serves a project
 * site, under a non-empty base path.
 */

export const ROOT = process.cwd();
export const OUT_DIR = join(ROOT, 'out');

function normalizeBase(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

/**
 * Base path of the build in out/, read from its root redirect
 * (`url=<base>/pl/`): build:preview derives it from the repository (D123), so
 * it is not always `/kabaninno`. E2E_BASE_PATH overrides; `/kabaninno` when
 * there is no build yet (assertPreviewBuild then explains).
 */
function builtBasePath(): string | null {
  const index = join(OUT_DIR, 'index.html');
  if (!existsSync(index)) return null;
  const target = /http-equiv="refresh" content="0; url=([^"]+)"/i.exec(
    readFileSync(index, 'utf8'),
  )?.[1];
  const match = target ? /^(.*)\/[a-z]{2}\/$/.exec(target) : null;
  return match ? match[1]! : null;
}

export const BASE_PATH = normalizeBase(
  process.env.E2E_BASE_PATH ?? builtBasePath() ?? '/kabaninno',
);

/**
 * Public site URL the build in out/ was made with (canonical, Open Graph,
 * sitemap), read from robots.txt's sitemap line, e.g.
 * `https://owner.github.io/kabaninno` or `https://kabaninno.invalid/kabaninno`.
 * Tests compare absolute URLs against it instead of assuming a host.
 */
export function builtSiteUrl(): string {
  const robots = readFileSync(join(OUT_DIR, 'robots.txt'), 'utf8');
  const sitemap = /^Sitemap:\s*(\S+)\/sitemap\.xml\s*$/im.exec(robots)?.[1];
  if (!sitemap)
    throw new Error('out/robots.txt has no Sitemap line: rebuild with npm run build:preview');
  return sitemap;
}

/** `/pl/services/web/` → `/kabaninno/pl/services/web/`. */
export function sitePath(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Escapes a string for use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches a full URL whose path (and optional query/hash) is exactly `sitePath(path)`. */
export function urlFor(path: string): RegExp {
  return new RegExp(`^https?://[^/]+${escapeRegExp(sitePath(path))}(?:[?#].*)?$`);
}

export interface ServerSetup {
  origin: string;
  webServer: {
    command: string;
    cwd: string;
    url: string;
    reuseExistingServer: boolean;
    timeout: number;
    stdout: 'ignore' | 'pipe';
    stderr: 'ignore' | 'pipe';
  };
}

/** `scripts/serve-out.mjs` on a dedicated port (each tool has its own). */
export function staticServer(port: number): ServerSetup {
  const origin = `http://localhost:${port}`;
  return {
    origin,
    webServer: {
      // No leading slash: Git Bash would rewrite "/kabaninno" into a Windows path.
      command: `node scripts/serve-out.mjs --base=${BASE_PATH.replace(/^\//, '')} --port=${port}`,
      // Configs live in different folders; the command is relative to the repo root.
      cwd: ROOT,
      url: `${origin}${sitePath('/pl/')}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  };
}

/**
 * Browser: the system Google Chrome locally (no browser download on this
 * machine), Playwright's bundled Chromium on CI (`PW_CHANNEL=chromium` or
 * unset with CI=true). WebGL runs on SwiftShader, so the scene renders in
 * headless mode without a GPU.
 */
export function chromeUse(): { channel?: string; launchOptions: LaunchOptions } {
  const requested = process.env.PW_CHANNEL ?? (process.env.CI ? 'chromium' : 'chrome');
  return {
    channel: requested === 'chromium' ? undefined : requested,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  };
}

/**
 * Fails fast with a clear message when out/ is missing or was built for
 * another base path (every asset would 404 and every test fail obscurely).
 */
export function assertPreviewBuild(): void {
  const index = join(OUT_DIR, 'index.html');
  if (!existsSync(index)) {
    throw new Error('out/index.html not found. Run `npm run build:preview` first.');
  }
  const html = readFileSync(index, 'utf8');
  const target = /http-equiv="refresh" content="0; url=([^"]+)"/i.exec(html)?.[1];
  if (target !== sitePath('/pl/')) {
    throw new Error(
      `out/ was built for another base path (root redirect → ${target ?? '?'}, expected ` +
        `${sitePath('/pl/')}). Run \`npm run build:preview\` (or set E2E_BASE_PATH).`,
    );
  }
}

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;
