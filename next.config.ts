import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { normalizeBasePath } from './src/lib/base-path';
import { locales } from './src/i18n/routing';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Empty for custom domains, "/<repo>" for GitHub Pages project sites.
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

/**
 * Texts for `src/app/global-error.tsx`: the `error` namespace of every
 * `messages/<locale>/ui.json`, inlined at build time. That component ships in
 * every page's base chunk, so importing the dictionaries there would send all
 * of them to every visitor.
 */
function globalErrorTexts(): string {
  const texts = Object.fromEntries(
    locales.map((locale) => {
      const file = join(process.cwd(), 'messages', locale, 'ui.json');
      const ui = JSON.parse(readFileSync(file, 'utf8')) as { error?: unknown };
      if (!ui.error) throw new Error(`Missing "error" namespace in ${file}`);
      return [locale, ui.error];
    }),
  );
  return JSON.stringify(texts);
}

const nextConfig: NextConfig = {
  // Static hosting only (GitHub Pages): no server at request time.
  output: 'export',
  // Every route becomes `<route>/index.html`, which static hosts serve natively.
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  reactStrictMode: true,
  env: {
    // Re-expose the normalized value so client code and config always agree.
    NEXT_PUBLIC_BASE_PATH: basePath,
    GLOBAL_ERROR_TEXTS: globalErrorTexts(),
  },
};

export default withNextIntl(nextConfig);
