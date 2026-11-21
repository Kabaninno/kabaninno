/**
 * Helpers for the Playwright runner scripts (screenshots, a11y audit):
 * argument parsing and spawning the Playwright CLI without a shell, so the
 * scripts behave the same on Windows, macOS and Linux.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const root = fileURLToPath(new URL('../..', import.meta.url));

/** `--name=value` → value, `--name` → true, missing → undefined. */
export function argValue(name, argv = process.argv.slice(2)) {
  for (const arg of argv) {
    if (arg === `--${name}`) return true;
    if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
  }
  return undefined;
}

/** Runs `playwright test <args>` and exits with its status. */
export function runPlaywright(args, env = {}) {
  const cli = require.resolve('@playwright/test/cli');
  const result = spawnSync(process.execPath, [cli, 'test', ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return result.status ?? 1;
}
