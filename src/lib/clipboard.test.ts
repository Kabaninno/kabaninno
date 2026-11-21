import { describe, expect, it, vi } from 'vitest';
import { copyText, type ClipboardEnv } from './clipboard';

function fakeDocument(copyResult: boolean | 'throw') {
  const appended: unknown[] = [];
  const area = {
    value: '',
    style: { cssText: '' },
    setAttribute: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
  };
  const previous = { focus: vi.fn() };
  const doc = {
    activeElement: previous,
    body: {
      appendChild: (node: unknown) => appended.push(node),
      removeChild: (node: unknown) => appended.splice(appended.indexOf(node), 1),
    },
    createElement: () => area,
    execCommand: vi.fn(() => {
      if (copyResult === 'throw') throw new Error('not allowed');
      return copyResult;
    }),
  };
  return { doc, area, appended, previous };
}

describe('copyText', () => {
  it('uses the async Clipboard API when it works', async () => {
    const writeText = vi.fn(async () => {});
    const { doc } = fakeDocument(true);
    expect(await copyText('Zażółć gęślą jaźń', { clipboard: { writeText }, document: doc })).toBe(
      true,
    );
    expect(writeText).toHaveBeenCalledWith('Zażółć gęślą jaźń');
    expect(doc.execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a hidden textarea when the Clipboard API is denied', async () => {
    const { doc, area, appended, previous } = fakeDocument(true);
    const env: ClipboardEnv = {
      clipboard: { writeText: async () => Promise.reject(new DOMException('denied')) },
      document: doc,
    };
    expect(await copyText('Привіт, ґанок', env)).toBe(true);
    expect(area.value).toBe('Привіт, ґанок');
    expect(area.setSelectionRange).toHaveBeenCalledWith(0, 'Привіт, ґанок'.length);
    expect(doc.execCommand).toHaveBeenCalledWith('copy');
    expect(appended).toHaveLength(0);
    expect(previous.focus).toHaveBeenCalled();
  });

  it('uses the fallback when there is no Clipboard API (non-secure origin)', async () => {
    const { doc } = fakeDocument(true);
    expect(await copyText('x', { clipboard: null, document: doc })).toBe(true);
  });

  it('reports failure instead of throwing', async () => {
    expect(await copyText('x', { clipboard: null, document: fakeDocument(false).doc })).toBe(false);
    const throwing = fakeDocument('throw');
    expect(await copyText('x', { clipboard: null, document: throwing.doc })).toBe(false);
    expect(throwing.appended).toHaveLength(0);
    expect(await copyText('x', { clipboard: null, document: null })).toBe(false);
  });
});
