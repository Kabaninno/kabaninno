import { describe, expect, it, vi } from 'vitest';
import { ApiSubmitter, TelegramLinkSubmitter, isLinkSubmitter } from './submitters';
import { TELEGRAM_URL_BUDGET } from './telegram';

describe('TelegramLinkSubmitter', () => {
  it('opens the t.me link with the whole text', async () => {
    const open = vi.fn(() => true);
    const submitter = new TelegramLinkSubmitter({ username: '@kabaninno_studio', open });
    const result = await submitter.submit({ text: 'Dzień dobry! Potrzebuję CRM.' });
    expect(result).toEqual({
      status: 'opened',
      url: 'https://t.me/kabaninno_studio?text=Dzie%C5%84%20dobry!%20Potrzebuj%C4%99%20CRM.',
      truncated: false,
    });
    expect(open).toHaveBeenCalledWith(result.status === 'opened' ? result.url : '');
  });

  it('applies the leading "@" rule to the (edited) text', () => {
    const link = new TelegramLinkSubmitter({ username: 'kabaninno_studio' }).prepare('@ hello');
    expect(link?.url).toBe('https://t.me/kabaninno_studio?text=%20%40%20hello');
  });

  it('shortens over-long texts and asks for the copy fallback', async () => {
    const open = vi.fn(() => true);
    const submitter = new TelegramLinkSubmitter({ username: 'kabaninno_studio', open });
    const text = 'Потрібна автоматизація документів і звітів. '.repeat(40);
    const result = await submitter.submit({ text });
    expect(result).toMatchObject({ status: 'needs-copy', reason: 'too-long', truncated: true });
    expect(open).toHaveBeenCalledOnce();
    if (result.status === 'needs-copy') {
      expect(result.url!.length).toBeLessThanOrEqual(TELEGRAM_URL_BUDGET);
      expect(decodeURIComponent(result.url!.split('text=')[1]!).endsWith('…')).toBe(true);
    }
  });

  it('reports a blocked tab', async () => {
    const submitter = new TelegramLinkSubmitter({
      username: 'kabaninno_studio',
      open: () => false,
    });
    expect(await submitter.submit({ text: 'Hi' })).toMatchObject({
      status: 'needs-copy',
      reason: 'blocked',
      truncated: false,
    });
  });

  it('with the placeholder username: no link, copy only', async () => {
    const open = vi.fn(() => true);
    const submitter = new TelegramLinkSubmitter({ username: '[TELEGRAM_USERNAME]', open });
    expect(submitter.configured).toBe(false);
    expect(submitter.prepare('Hi')).toBeNull();
    expect(await submitter.submit({ text: 'Hi' })).toEqual({
      status: 'needs-copy',
      url: null,
      truncated: false,
      reason: 'unconfigured',
    });
    expect(open).not.toHaveBeenCalled();
  });
});

describe('ApiSubmitter', () => {
  it('throws a clear error while NEXT_PUBLIC_API_URL is unset', async () => {
    const submitter = new ApiSubmitter({ endpoint: '' });
    expect(submitter.configured).toBe(false);
    await expect(submitter.submit({ text: 'Hi' })).rejects.toThrow(
      /NEXT_PUBLIC_API_URL is not set/,
    );
  });

  it('reads NEXT_PUBLIC_API_URL by default', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com/leads');
    expect(new ApiSubmitter().configured).toBe(true);
    vi.unstubAllEnvs();
  });

  it('POSTs the lead as JSON and reports success', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 201 }));
    const submitter = new ApiSubmitter({ endpoint: 'https://api.example.com/leads', fetcher });
    const draft = undefined;
    expect(await submitter.submit({ text: 'Привіт', locale: 'uk', draft })).toEqual({
      status: 'sent',
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.com/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Привіт', locale: 'uk' }),
    });
  });

  it('throws on an error response', async () => {
    const submitter = new ApiSubmitter({
      endpoint: 'https://api.example.com/leads',
      fetcher: async () => ({ ok: false, status: 503 }),
    });
    await expect(submitter.submit({ text: 'Hi' })).rejects.toThrow(/answered 503/);
  });
});

describe('isLinkSubmitter', () => {
  it('tells link submitters (anchors in the UI) from API submitters (a Send button)', () => {
    const telegram = new TelegramLinkSubmitter({ username: 'kabaninno_studio' });
    expect(isLinkSubmitter(telegram)).toBe(true);
    expect(telegram.chatUrl()).toBe('https://t.me/kabaninno_studio');
    expect(new TelegramLinkSubmitter({ username: '[TELEGRAM_USERNAME]' }).chatUrl()).toBeNull();
    expect(isLinkSubmitter(new ApiSubmitter({ endpoint: 'https://api.example.com' }))).toBe(false);
  });
});
