import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { sitePath, type ViewportName } from '../support/env';
import { formatIssues, IssueCollector } from '../support/issues';
import {
  sceneFocusFor,
  waitForFlightSettled,
  waitForFonts,
  waitForScene,
  waitForSceneReady,
} from '../support/scene';
import { STATES } from './states';
import { META_DIR, SCREENSHOT_DIR } from './output';

/**
 * One test per state and viewport (projects "desktop" / "mobile"). Never
 * fails on console errors: they are recorded in the manifest and printed,
 * so a broken state still produces its picture for review.
 */

const PREFIX: Record<ViewportName, string> = { desktop: 'd', mobile: 'm' };
/** Calm time after the canvas faded in: drift, hover easing, label fades. */
const SETTLE_MS = 900;
/**
 * Pins the scene quality tier (read once at mount, survives soft navigation).
 * Software GL would otherwise let PerformanceMonitor step down to "low" and
 * drop bloom, so shots would not show the real look. `SCREENSHOT_QUALITY=`
 * (empty) keeps adaptive quality.
 */
const QUALITY = process.env.SCREENSHOT_QUALITY ?? 'high';

function withQuality(url: string): string {
  if (!QUALITY) return url;
  const hash = url.indexOf('#');
  const [base, fragment] = hash === -1 ? [url, ''] : [url.slice(0, hash), url.slice(hash)];
  return `${base}${base.includes('?') ? '&' : '?'}quality=${encodeURIComponent(QUALITY)}${fragment}`;
}

for (const state of STATES) {
  test(state.name, async ({ page, context }, testInfo) => {
    const viewport = testInfo.project.name as ViewportName;
    test.skip(
      Boolean(state.viewports && !state.viewports.includes(viewport)),
      'not for this viewport',
    );
    test.setTimeout(state.series ? 300_000 : 60_000);

    const issues = new IssueCollector(context);
    if (state.status === 404) issues.allowNotFound(/.*/);
    const files: string[] = [];
    // Wall-clock timeline (ms since the page load started): in headless
    // SwiftShader a frame can take ~1 s, so series frames land later than
    // their nominal offsets; reviewers read the real times here.
    const timeline: { atMs: number; event: string }[] = [];
    const startedAt = Date.now();
    const mark = (event: string) => timeline.push({ atMs: Date.now() - startedAt, event });
    const frame = async (suffix?: string) => {
      const file = `${PREFIX[viewport]}-${state.name}${suffix ? `-${suffix}` : ''}.png`;
      mark(`shot ${file}`);
      await page.screenshot({ path: join(SCREENSHOT_DIR, file), caret: 'hide' });
      files.push(file);
    };

    const url = withQuality(sitePath(state.path));
    if (state.clock) await page.clock.install();
    if (!state.intro) {
      // A returning visitor: the first-visit intro (D94) does not play.
      await page.addInitScript(() => {
        try {
          localStorage.setItem('kabaninno.intro.v2', 'true');
        } catch {
          // ignore
        }
      });
    }
    await state.init?.(page);
    const response = await page.goto(url);
    const status = response?.status() ?? 0;
    const sceneReady = state.scene === false ? null : await waitForScene(page);
    await waitForFonts(page);
    const settled =
      state.scene === false
        ? null
        : await waitForFlightSettled(page, { focus: sceneFocusFor(state.path) });
    // The focused content is compiled and visible (scene-engineer's
    // `html[data-scene-ready]`, e.g. the portfolio archive cards, V5-01).
    const contentReady =
      state.scene === false ? null : await waitForSceneReady(page, sceneFocusFor(state.path));
    await page.waitForTimeout(SETTLE_MS);

    const context2 = { viewport, frame: (suffix: string) => frame(suffix), mark };
    if (state.series) {
      await state.series(page, context2);
    } else {
      if (state.prepare) {
        await state.prepare(page, context2);
        await page.waitForTimeout(450);
      }
      await frame();
    }

    const problems = issues.unexpected();
    if (problems.length > 0) {
      console.warn(
        `[screenshots] ${viewport} ${state.name}: browser issues\n${formatIssues(problems)}`,
      );
    }
    if (status !== (state.status ?? 200)) {
      console.warn(`[screenshots] ${viewport} ${state.name}: HTTP ${status} for ${url}`);
    }
    if (sceneReady === false) {
      console.warn(`[screenshots] ${viewport} ${state.name}: the scene canvas never faded in`);
    }
    if (contentReady === false) {
      console.warn(`[screenshots] ${viewport} ${state.name}: html[data-scene-ready] never matched`);
    }

    mkdirSync(META_DIR, { recursive: true });
    writeFileSync(
      join(META_DIR, `${PREFIX[viewport]}-${state.name}.json`),
      JSON.stringify(
        {
          state: state.name,
          viewport,
          url,
          status,
          tags: state.tags ?? [],
          files,
          timeline,
          sceneReady,
          flightSettled: settled,
          sceneContentReady: contentReady,
          issues: problems,
          warnings: issues.warnings.slice(0, 20),
          capturedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  });
}
