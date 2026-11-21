import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('./', import.meta.url));
const src = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: src },
      { find: /^~\//, replacement: root },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'content/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
});
