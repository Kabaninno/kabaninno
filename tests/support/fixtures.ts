import { test as base, expect } from '@playwright/test';
import { formatIssues, IssueCollector } from './issues';

/**
 * Playwright `test` for e2e specs. Every test gets an automatic browser
 * guard: any console error, uncaught page error, failed request or HTTP
 * 4xx/5xx response fails the test, unless the test allowed it explicitly
 * (`issues.allowNotFound(...)`, `issues.allow(...)`).
 */
export const test = base.extend<{ issues: IssueCollector; introSeen: boolean; seedIntro: void }>({
  /**
   * The first-visit intro (D94) plays on a fresh profile's first home visit.
   * Tests start as returning visitors by default, so flights and reveals stay
   * deterministic; intro tests opt out with `test.use({ introSeen: false })`.
   */
  introSeen: [true, { option: true }],
  seedIntro: [
    async ({ context, introSeen }, provide) => {
      if (introSeen) {
        await context.addInitScript(() => {
          try {
            localStorage.setItem('kabaninno.intro.v1', 'true');
          } catch {
            // Storage blocked: the intro may play; tests that care check for it.
          }
        });
      }
      await provide();
    },
    { auto: true },
  ],
  issues: [
    async ({ context }, provide, testInfo) => {
      const collector = new IssueCollector(context);
      await provide(collector);
      if (collector.warnings.length > 0) {
        testInfo.annotations.push({
          type: 'console warnings',
          description: collector.warnings.slice(0, 10).join('\n'),
        });
      }
      const unexpected = collector.unexpected();
      if (unexpected.length > 0) {
        throw new Error(`Unexpected browser issues:\n${formatIssues(unexpected)}`);
      }
    },
    { auto: true },
  ],
});

export { expect };
