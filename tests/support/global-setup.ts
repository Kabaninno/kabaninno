import { assertPreviewBuild } from './env';
import { builtProjects } from './site';

/**
 * Runs once before any Playwright test: checks that out/ is a preview build
 * and says which content it holds (production by default; draft portfolio
 * cases only after `npm run build:preview -- --drafts`).
 */
export default function globalSetup(): void {
  assertPreviewBuild();
  const cases = builtProjects().length;
  console.log(
    cases > 0
      ? `[playwright] out/ includes ${cases} draft case page(s): portfolio case tests and states run.`
      : '[playwright] out/ is a production build (no case pages): portfolio case tests and states are skipped.',
  );
}
