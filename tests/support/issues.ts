import type { BrowserContext, ConsoleMessage, Request, Response } from '@playwright/test';

/**
 * Collects everything that should never happen in the browser: console
 * errors, uncaught page errors, failed requests, HTTP 4xx/5xx responses and
 * the console warnings listed in `FATAL_WARNING`. Other console warnings are
 * kept separately (reported, not fatal).
 */

export type IssueKind = 'console' | 'warning' | 'pageerror' | 'requestfailed' | 'http';

/**
 * Console warnings that are failures too (QA-M2-06): three.js warnings and
 * the shader-compile extension warning that M2 removed must not come back.
 * The R3F THREE.Clock deprecation is filtered at the source (D30).
 */
const FATAL_WARNING = /^THREE\.|KHR_parallel_shader_compile/;

export interface BrowserIssue {
  kind: IssueKind;
  text: string;
  /** Resource URL (failed request, HTTP error, console message source). */
  url?: string;
}

interface Allowance {
  kind?: IssueKind;
  /** Tested against `${text} ${url}`. */
  match: RegExp;
}

/**
 * Request failures that are cancellations, not errors: navigations and
 * prefetches aborted by the next navigation, or by closing the page.
 */
const CANCELLED = /net::ERR_ABORTED/;

export class IssueCollector {
  readonly issues: BrowserIssue[] = [];
  readonly warnings: string[] = [];
  private readonly allowances: Allowance[] = [];

  constructor(context: BrowserContext) {
    context.on('console', (message: ConsoleMessage) => {
      const type = message.type();
      if (type === 'error') {
        this.issues.push({ kind: 'console', text: message.text(), url: message.location().url });
      } else if (type === 'warning') {
        const text = message.text();
        if (FATAL_WARNING.test(text)) {
          this.issues.push({ kind: 'warning', text, url: message.location().url });
        } else {
          this.warnings.push(text);
        }
      }
    });
    context.on('weberror', (error) => {
      const err = error.error();
      this.issues.push({ kind: 'pageerror', text: `${err.name}: ${err.message}` });
    });
    context.on('requestfailed', (request: Request) => {
      const failure = request.failure()?.errorText ?? 'failed';
      if (CANCELLED.test(failure)) return;
      this.issues.push({ kind: 'requestfailed', text: failure, url: request.url() });
    });
    context.on('response', (response: Response) => {
      if (response.status() >= 400) {
        this.issues.push({ kind: 'http', text: `HTTP ${response.status()}`, url: response.url() });
      }
    });
  }

  /** Tolerates issues matching `match` (optionally of one kind) for this test only. */
  allow(match: RegExp, kind?: IssueKind): void {
    this.allowances.push({ match, kind });
  }

  /**
   * An intentional 404 (e.g. the not-found page): the document response and
   * Chrome's matching "Failed to load resource" console line.
   */
  allowNotFound(url: RegExp): void {
    this.allowances.push({ kind: 'http', match: new RegExp(`HTTP 404 .*${url.source}`) });
    this.allowances.push({
      kind: 'console',
      match: new RegExp(
        `Failed to load resource: the server responded with a status of 404.*${url.source}`,
      ),
    });
  }

  unexpected(): BrowserIssue[] {
    return this.issues.filter(
      (issue) =>
        !this.allowances.some(
          (allowance) =>
            (allowance.kind === undefined || allowance.kind === issue.kind) &&
            allowance.match.test(`${issue.text} ${issue.url ?? ''}`),
        ),
    );
  }
}

export function formatIssues(issues: readonly BrowserIssue[]): string {
  return issues
    .map((issue) => `  [${issue.kind}] ${issue.text}${issue.url ? ` (${issue.url})` : ''}`)
    .join('\n');
}
