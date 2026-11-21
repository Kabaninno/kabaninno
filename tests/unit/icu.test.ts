import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/routing';

/**
 * Every message in every dictionary must be valid ICU MessageFormat and
 * format without errors (sample values for the arguments it uses), so a
 * broken plural or a stray brace fails here instead of in the browser.
 */

type Tree = { [key: string]: string | string[] | Tree };

function load(locale: string): Tree {
  const dir = join(process.cwd(), 'messages', locale);
  return Object.assign(
    {},
    ...readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as Tree),
  ) as Tree;
}

function paths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') return [path];
    if (Array.isArray(value)) return [];
    return paths(value, path);
  });
}

const SAMPLE = {
  studio: 'KABANINNO',
  count: 2,
  min: 2,
  max: 80,
  current: 3,
  total: 7,
  index: '01',
};

describe.each(locales)('ICU messages (%s)', (locale) => {
  const messages = load(locale);

  it('all format without errors', () => {
    const failures: string[] = [];
    const t = createTranslator({
      locale,
      messages,
      onError: (error) => failures.push(error.message),
      getMessageFallback: ({ key }) => key,
    });
    for (const path of paths(messages)) {
      const raw = t.raw(path as never) as string;
      const values = Object.fromEntries(
        [...raw.matchAll(/\{(\w+)/g)].map(([, name]) => [
          name!,
          (SAMPLE as Record<string, string | number>)[name!] ?? 'x',
        ]),
      );
      const text = t(path as never, values as never) as string;
      if (/[{}]/.test(text)) failures.push(`${path}: unformatted placeholder in "${text}"`);
    }
    expect(failures).toEqual([]);
  });
});
