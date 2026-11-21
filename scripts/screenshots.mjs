#!/usr/bin/env node
/**
 * Screenshots of the key states (BRIEF B2.7) from the static preview build
 * (out/, base path /kabaninno), desktop 1440×900 and mobile 390×844.
 * States are data-driven: tests/visual/states.ts.
 *
 *   npm run build:preview
 *   npm run screenshots -- --label=M2-ui                 # → screenshots/M2-ui/
 *   npm run screenshots -- --label=M2-ui --only=system   # states matching a regex
 *   npm run screenshots -- --viewport=mobile             # one viewport only
 *   npm run screenshots -- --workers=1                   # serial (steadier timing)
 *
 * Files: d-<state>.png / m-<state>.png (+ -in-f1… for transition frames) and
 * manifest.json (URL, HTTP status, scene readiness, browser issues per shot).
 * A full run (no --only / --viewport) replaces the label folder.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { argValue, root, runPlaywright } from './lib/playwright.mjs';

const label = String(argValue('label') ?? 'latest').replace(/[^\w.-]+/g, '-');
const only = argValue('only');
const viewport = argValue('viewport');
const workers = argValue('workers');

const args = ['--config=tests/visual/playwright.config.ts'];
if (typeof only === 'string') args.push(`--grep=${only}`);
if (typeof viewport === 'string') args.push(`--project=${viewport}`);
if (typeof workers === 'string') args.push(`--workers=${workers}`);

if (only === undefined && viewport === undefined) {
  rmSync(join(root, 'screenshots', label), { recursive: true, force: true });
}

console.log(`[screenshots] label "${label}" → screenshots/${label}/`);
process.exit(runPlaywright(args, { SCREENSHOT_LABEL: label }));
