import type { Page } from '@playwright/test';

/**
 * Helpers around the persistent 3D canvas and the UI ↔ scene hooks:
 * - `canvas[data-scene-instance]`: stays constant while the canvas lives;
 * - the canvas fades in (opacity 0 → 1) after its first frame;
 * - `html[data-scene-flight]` is set while a camera flight runs (FlightStatus).
 */

export const CANVAS = 'canvas[data-scene-instance]';

/**
 * Waits until the scene canvas exists and it and its ancestors are fully
 * opaque (fade-in finished). Returns false on timeout (no WebGL, scene failed).
 */
export async function waitForScene(page: Page, timeout = 20_000): Promise<boolean> {
  try {
    await page.waitForFunction(
      (selector) => {
        const canvas = document.querySelector(selector);
        if (!canvas) return false;
        for (let el: Element | null = canvas; el && el !== document.body; el = el.parentElement) {
          if (Number.parseFloat(getComputedStyle(el).opacity) < 0.999) return false;
        }
        return true;
      },
      CANVAS,
      { timeout, polling: 100 },
    );
    return true;
  } catch {
    return false;
  }
}

export interface SettleOptions {
  /**
   * Locale-less path the camera must settle on (`html[data-scene-focus]`,
   * D56). The most reliable signal: it only matches after the scene arrived.
   */
  focus?: string;
  /** Without `focus`: how long to wait for a flight to start (it starts in the scene's next frame). */
  startGraceMs?: number;
  timeout?: number;
}

/**
 * Waits until the camera has settled. With `focus`, until the scene reports
 * that exact settled state and no flight runs. Without it, first gives a
 * flight up to `startGraceMs` to start (right after a navigation the flight
 * is not published yet, QA-M2-05), then waits for it to end. Returns false
 * on timeout.
 */
export async function waitForFlightSettled(
  page: Page,
  { focus, startGraceMs = 1500, timeout = 20_000 }: SettleOptions = {},
): Promise<boolean> {
  try {
    if (focus !== undefined) {
      await page.waitForFunction(
        (expected) => {
          const root = document.documentElement;
          return root.dataset.sceneFocus === expected && !root.hasAttribute('data-scene-flight');
        },
        focus,
        { timeout, polling: 50 },
      );
      return true;
    }
    await page
      .waitForFunction(() => document.documentElement.hasAttribute('data-scene-flight'), null, {
        timeout: startGraceMs,
        polling: 50,
      })
      .catch(() => {});
    await page.waitForFunction(
      () => !document.documentElement.hasAttribute('data-scene-flight'),
      null,
      { timeout, polling: 50 },
    );
    return true;
  } catch {
    return false;
  }
}

/** Locale-less path of a locale-prefixed site path: "/pl/services/web/?q" → "/services/web/". */
export function sceneFocusFor(path: string): string {
  const clean = path.split(/[?#]/)[0]!;
  const stripped = clean.replace(/^\/(pl|en|uk)(?=\/|$)/, '');
  return stripped === '' ? '/' : stripped;
}

export async function sceneInstance(page: Page): Promise<string | null> {
  return page.locator(CANVAS).first().getAttribute('data-scene-instance');
}

/**
 * Tags the current document. A soft (client-side) navigation keeps the tag;
 * a full document load loses it.
 */
export async function markDocument(page: Page): Promise<string> {
  const token = `doc-${Math.random().toString(36).slice(2)}`;
  await page.evaluate((value) => {
    (window as Window & { __e2eDocument?: string }).__e2eDocument = value;
  }, token);
  return token;
}

export async function documentMark(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as Window & { __e2eDocument?: string }).__e2eDocument);
}

/** Waits for fonts so text metrics (and screenshots) are final. */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

/** Makes WebGL unavailable before the page loads, as on devices without it. */
export async function withoutWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/^(experimental-)?webgl2?$/.test(type)) return null;
      return (original as (...args: unknown[]) => RenderingContext | null).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
}

/**
 * Removes the WebGL 2 API before the page loads, as in browsers without it:
 * the UI then switches to simple (2D) mode automatically (D94), before the
 * first paint. (`withoutWebGL` keeps the API and only fails the context,
 * like a blocklisted GPU: the scene chunk loads and gives up silently.)
 */
export async function withoutWebGL2Api(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (window as Window & { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext;
  });
}

/** Stores the visitor's simple-mode choice before the page loads (`kabaninno.simpleMode.v1`). */
export async function withSimpleMode(page: Page, simple = true): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('kabaninno.simpleMode.v1', JSON.stringify(value));
  }, simple);
}

/**
 * Waits for `html[data-scene-ready="<locale-less path>"]` (scene-engineer,
 * F1): the camera has settled on the URL and the focused content (e.g. the
 * portfolio archive cards) is compiled and visible. Removed during flights
 * and the intro. Returns false on timeout.
 */
export async function waitForSceneReady(
  page: Page,
  path: string,
  timeout = 30_000,
): Promise<boolean> {
  try {
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.sceneReady === expected,
      path,
      { timeout, polling: 100 },
    );
    return true;
  } catch {
    return false;
  }
}
