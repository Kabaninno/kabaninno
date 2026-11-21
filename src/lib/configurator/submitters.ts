import type { ConfiguratorDraft } from './draft';
import {
  TELEGRAM_URL_BUDGET,
  fitTextToTelegramUrl,
  isValidTelegramUsername,
  normalizeUsername,
  telegramUrl,
} from './telegram';

/**
 * Lead submission (PLAN §2.11, BRIEF B1): today the visitor sends the
 * message from their own Telegram (`TelegramLinkSubmitter`); later a backend
 * may take it (`ApiSubmitter`, `NEXT_PUBLIC_API_URL`). The UI talks to the
 * interface only. The text is the final (possibly edited) summary text.
 */
export interface LeadSubmission {
  text: string;
  draft?: ConfiguratorDraft;
  locale?: string;
}

export type LeadResult =
  /** The chat was opened with the whole text as a draft. */
  | { status: 'opened'; url: string; truncated: false }
  /**
   * The visitor should copy the text: it had to be shortened for the link
   * (`too-long`, the chat still opened with the shortened draft), the
   * browser blocked the new tab (`blocked`), or no Telegram username is
   * configured yet (`unconfigured`, no link at all).
   */
  | {
      status: 'needs-copy';
      url: string | null;
      truncated: boolean;
      reason: 'too-long' | 'blocked' | 'unconfigured';
    }
  /** A backend accepted the lead. */
  | { status: 'sent' };

export interface LeadSubmitter {
  submit(submission: LeadSubmission): Promise<LeadResult>;
}

export interface PreparedTelegramLink {
  url: string;
  /** The text inside the link (shortened when `truncated`). */
  text: string;
  truncated: boolean;
}

/**
 * A submitter that hands the lead over through a link the visitor opens
 * (Telegram). The UI renders real anchors for it (`prepare`, `chatUrl`);
 * other submitters (`ApiSubmitter`) get a plain "Send" button calling
 * `submit`, so swapping them needs no UI rewrite.
 */
export interface LinkLeadSubmitter extends LeadSubmitter {
  readonly configured: boolean;
  prepare(text: string): PreparedTelegramLink | null;
  /** The chat without a prefilled text ("Open chat" fallback), or null when unconfigured. */
  chatUrl(): string | null;
}

export function isLinkSubmitter(submitter: LeadSubmitter): submitter is LinkLeadSubmitter {
  return 'prepare' in submitter && 'chatUrl' in submitter;
}

/**
 * Opens a URL in a new tab and reports whether the browser allowed it. Must
 * run inside the click handler (a user gesture): after an `await` the user
 * activation may be gone and popup blockers step in. `noopener` is not passed
 * as a feature because `window.open` then always returns null; the opener is
 * cut by hand instead.
 */
export function openInNewTab(url: string): boolean {
  if (typeof window === 'undefined') return false;
  const opened = window.open(url, '_blank');
  if (!opened) return false;
  try {
    opened.opener = null;
  } catch {
    // Cross-origin by now; nothing to cut.
  }
  return true;
}

/**
 * Hands the lead to Telegram as a draft in a personal chat
 * (`https://t.me/<username>?text=…`).
 *
 * Why an https t.me link, opened by a user gesture:
 * - On phones, iOS (Universal Links) and Android (App Links) open the
 *   Telegram app straight from t.me; without the app the t.me page offers
 *   the web client or the store. A `tg://` link does nothing without the app.
 * - On desktop the t.me page opens Telegram Desktop (or Telegram Web) itself.
 * - Plain navigation from a click is never blocked; the most robust UI is a
 *   real `<a href={prepare(text).url} target="_blank" rel="noopener">`, with
 *   `submit()` for programmatic flows (it reports a blocked tab).
 *
 * The username is validated; with the `[TELEGRAM_USERNAME]` placeholder the
 * submitter reports `unconfigured` and the UI keeps only "Copy".
 */
export class TelegramLinkSubmitter implements LinkLeadSubmitter {
  readonly username: string;
  private readonly maxUrlLength: number;
  private readonly open: (url: string) => boolean;

  constructor({
    username,
    maxUrlLength = TELEGRAM_URL_BUDGET,
    open = openInNewTab,
  }: {
    username: string;
    maxUrlLength?: number;
    open?: (url: string) => boolean;
  }) {
    this.username = normalizeUsername(username);
    this.maxUrlLength = maxUrlLength;
    this.open = open;
  }

  get configured(): boolean {
    return isValidTelegramUsername(this.username);
  }

  chatUrl(): string | null {
    return this.configured ? `https://t.me/${this.username}` : null;
  }

  /** The link for `text` within the URL budget, or null without a valid username. */
  prepare(text: string): PreparedTelegramLink | null {
    if (!this.configured) return null;
    const fitted = fitTextToTelegramUrl(this.username, text, this.maxUrlLength);
    return { url: telegramUrl(this.username, fitted.text), ...fitted };
  }

  async submit({ text }: LeadSubmission): Promise<LeadResult> {
    const link = this.prepare(text);
    if (!link) return { status: 'needs-copy', url: null, truncated: false, reason: 'unconfigured' };
    const opened = this.open(link.url);
    if (!opened) {
      return { status: 'needs-copy', url: link.url, truncated: link.truncated, reason: 'blocked' };
    }
    if (link.truncated) {
      return { status: 'needs-copy', url: link.url, truncated: true, reason: 'too-long' };
    }
    return { status: 'opened', url: link.url, truncated: false };
  }
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

/**
 * Future backend submitter (CRM / API living elsewhere, BRIEF B1). Not wired
 * into the UI yet. POSTs `{ text, draft, locale }` as JSON to
 * `NEXT_PUBLIC_API_URL`; throws a clear error while that variable is unset.
 */
export class ApiSubmitter implements LeadSubmitter {
  private readonly endpoint: string | undefined;
  private readonly fetcher: FetchLike | undefined;

  constructor({
    endpoint = process.env.NEXT_PUBLIC_API_URL,
    fetcher = typeof fetch === 'function' ? (fetch as unknown as FetchLike) : undefined,
  }: { endpoint?: string; fetcher?: FetchLike } = {}) {
    this.endpoint = endpoint?.trim() || undefined;
    this.fetcher = fetcher;
  }

  get configured(): boolean {
    return this.endpoint !== undefined;
  }

  async submit({ text, draft, locale }: LeadSubmission): Promise<LeadResult> {
    if (!this.endpoint) {
      throw new Error(
        'ApiSubmitter: NEXT_PUBLIC_API_URL is not set. Set it at build time to the lead endpoint, ' +
          'or use TelegramLinkSubmitter.',
      );
    }
    if (!this.fetcher) throw new Error('ApiSubmitter: fetch is not available.');
    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, draft, locale }),
    });
    if (!response.ok) throw new Error(`ApiSubmitter: the endpoint answered ${response.status}.`);
    return { status: 'sent' };
  }
}
