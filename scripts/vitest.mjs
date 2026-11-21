#!/usr/bin/env node
/**
 * Runs Vitest from a normalized working directory.
 *
 * On Windows, a lower-case drive letter in the cwd (`d:\project`, common in
 * Git Bash and VS Code terminals) makes Vitest load two copies of its runner
 * (`file:///d:/…` and `file:///D:/…`), and every suite fails with
 * "Cannot read properties of undefined (reading 'config')". Upper-casing the
 * drive letter before starting Vitest avoids it. Elsewhere this is a no-op.
 *
 *   node scripts/vitest.mjs run      # npm test
 *   node scripts/vitest.mjs          # npm run test:watch
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const cwd =
  process.platform === 'win32'
    ? process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase())
    : process.cwd();

const bin = join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
