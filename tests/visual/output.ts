import { join } from 'node:path';
import { ROOT } from '../support/env';

/** `screenshots/<label>/` (label from `npm run screenshots -- --label=<name>`). */
export const SCREENSHOT_LABEL = (process.env.SCREENSHOT_LABEL ?? 'latest').replace(
  /[^\w.-]+/g,
  '-',
);
export const SCREENSHOT_DIR = join(ROOT, 'screenshots', SCREENSHOT_LABEL);
/** Per-shot metadata written by the workers, merged into manifest.json at the end. */
export const META_DIR = join(SCREENSHOT_DIR, '.meta');
