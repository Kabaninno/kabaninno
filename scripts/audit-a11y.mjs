#!/usr/bin/env node
/**
 * axe-core audit of key routes (pl, uk; desktop and mobile) on the static
 * preview build, written as a JSON summary for perf-a11y-auditor.
 *
 *   npm run build:preview
 *   npm run audit:a11y                                   # → reports/perf-a11y/axe-summary.json
 *   npm run audit:a11y -- --out=reports/perf-a11y/axe-M2.json
 *   npm run audit:a11y -- --strict                       # exit 1 on serious/critical
 */
import { resolve } from 'node:path';
import { argValue, root, runPlaywright } from './lib/playwright.mjs';

const out = argValue('out');
const env = {};
if (typeof out === 'string') env.A11Y_OUT = resolve(root, out);
if (argValue('strict')) env.A11Y_STRICT = '1';

process.exit(runPlaywright(['--config=tests/a11y/playwright.config.ts'], env));
