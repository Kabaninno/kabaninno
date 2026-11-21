/**
 * Copies text to the clipboard (the configurator's "Copy text" fallback).
 * 1. `navigator.clipboard.writeText` (secure contexts; may be denied).
 * 2. A hidden, read-only textarea + `document.execCommand('copy')`: older
 *    browsers, non-secure origins, denied permissions. Must run in a click
 *    handler (user gesture). Focus and selection are restored afterwards.
 * Resolves `true` when one of them succeeded; never throws.
 */

interface TextareaLike {
  value: string;
  style: { cssText: string };
  setAttribute(name: string, value: string): void;
  select(): void;
  setSelectionRange?(start: number, end: number): void;
}

interface DocumentLike {
  body: { appendChild(node: unknown): unknown; removeChild(node: unknown): unknown } | null;
  activeElement?: unknown;
  createElement(tag: 'textarea'): TextareaLike;
  execCommand(command: 'copy'): boolean;
}

export interface ClipboardEnv {
  clipboard?: { writeText(text: string): Promise<void> } | null;
  document?: DocumentLike | null;
}

function defaultEnv(): ClipboardEnv {
  return {
    clipboard: typeof navigator !== 'undefined' ? (navigator.clipboard ?? null) : null,
    document: typeof document !== 'undefined' ? (document as unknown as DocumentLike) : null,
  };
}

function copyWithTextarea(text: string, doc: DocumentLike): boolean {
  if (!doc.body) return false;
  const previous = doc.activeElement as { focus?: (options?: { preventScroll?: boolean }) => void };
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  doc.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange?.(0, text.length); // iOS Safari ignores select() alone
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    doc.body.removeChild(area);
    previous?.focus?.({ preventScroll: true });
  }
}

export async function copyText(text: string, env: ClipboardEnv = defaultEnv()): Promise<boolean> {
  if (env.clipboard) {
    try {
      await env.clipboard.writeText(text);
      return true;
    } catch {
      // Denied or not focused: try the legacy path.
    }
  }
  return env.document ? copyWithTextarea(text, env.document) : false;
}
