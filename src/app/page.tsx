import type { Metadata } from 'next';
import { siteConfig } from '~/site.config';
import { getMessagesFor } from '@/i18n/messages';
import { defaultLocale, locales, type Locale } from '@/i18n/routing';
import { withBasePath } from '@/lib/base-path';
import { rootRedirectScript } from '@/lib/locale-choice';
import { localizedPath } from '@/lib/metadata';
import { absoluteUrl } from '@/lib/site-url';
import { fontVariables } from './fonts';

/*
 * `/` → the visitor's language (D137). Static hosting has no server-side
 * redirects, so this page (out/index.html) redirects with an inline script
 * that picks the locale (remembered choice → browser languages: uk → /uk/,
 * en → /en/, anything else → /pl/) and keeps the query string and hash, a
 * meta refresh to `/pl/` for visitors without JS, and visible links. The
 * canonical points at `/pl/`.
 * scripts/postbuild.mjs then rewrites the exported HTML into a minimal
 * document built from these values (no app scripts or font preloads, P-06).
 */

const target = withBasePath(localizedPath(defaultLocale, '/'));
const targets = Object.fromEntries(
  locales.map((locale) => [locale, withBasePath(localizedPath(locale, '/'))]),
) as Record<Locale, string>;

export const metadata: Metadata = {
  title: { absolute: siteConfig.studioName },
  alternates: { canonical: absoluteUrl(localizedPath(defaultLocale, '/')) },
};

export default function RootRedirectPage() {
  const languageNames = getMessagesFor(defaultLocale).hud.languageNames;
  return (
    <html lang={defaultLocale} className={fontVariables}>
      <head>
        <meta httpEquiv="refresh" content={`0; url=${target}`} />
        <script
          // Runs before hydration; keeps ?query and #hash (deep links, campaigns).
          dangerouslySetInnerHTML={{ __html: rootRedirectScript(targets) }}
        />
      </head>
      <body>
        <div className="backdrop-cosmos" aria-hidden="true" />
        <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
          <a
            href={target}
            className="font-display text-lg tracking-[0.2em] text-ink underline decoration-white/25 underline-offset-8 transition-colors hover:decoration-white focus-visible:decoration-white"
          >
            {siteConfig.studioName}
          </a>
          <ul className="flex flex-wrap justify-center gap-2">
            {locales.map((locale) => (
              <li key={locale}>
                <a
                  href={withBasePath(localizedPath(locale, '/'))}
                  hrefLang={locale}
                  lang={locale}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-muted transition-colors hover:bg-white/5 hover:text-ink focus-visible:text-ink active:bg-white/10"
                >
                  {languageNames[locale]}
                </a>
              </li>
            ))}
          </ul>
        </main>
      </body>
    </html>
  );
}
