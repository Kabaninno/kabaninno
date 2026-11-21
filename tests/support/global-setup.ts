import { assertPreviewBuild } from './env';

/** Runs once before any Playwright test: checks that out/ is a preview build. */
export default function globalSetup(): void {
  assertPreviewBuild();
}
