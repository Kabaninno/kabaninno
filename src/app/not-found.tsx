import type { Metadata } from 'next';
import { siteConfig } from '~/site.config';
import { NodeMark } from '@/components/hud/NodeMark';
import { getMessagesFor } from '@/i18n/messages';
import { defaultLocale, locales } from '@/i18n/routing';
import { withBasePath } from '@/lib/base-path';
import { LOCALE_CODES } from '@/lib/locale-choice';
import { localizedPath } from '@/lib/metadata';
import { NOT_FOUND_SKY, starLayer } from '@/lib/starfield';
import { bindShortWords } from '@/lib/typography';
import { fontVariables } from './fonts';

/*
 * Global 404 (out/404.html). GitHub Pages serves this file for any unknown URL
 * at any depth, so it is trilingual, has no locale context, and uses raw links
 * built with `withBasePath()` (absolute, base-path aware). Next.js emits its
 * CSS/JS with absolute, base-path-prefixed URLs as well.
 *
 * No 3D here: a CSS star layer over the cosmos backdrop keeps it on-brand and
 * weightless. The cards use the HUD glass (blurred, 72 % fill), so no star
 * reads as a stray dot inside the text (visual M3-02). Next.js adds
 * `<meta name="robots" content="noindex">` itself.
 */

export const metadata: Metadata = {
  title: { absolute: `404 · ${siteConfig.studioName}` },
};

/** Seeded random star tiles, rendered once at build time. */
const sky = NOT_FOUND_SKY.map(starLayer);
const skyStyle = {
  backgroundImage: sky.map((layer) => layer.image).join(', '),
  backgroundSize: sky.map((layer) => layer.size).join(', '),
};

export default function NotFound() {
  return (
    <html lang={defaultLocale} className={fontVariables}>
      <body>
        <div className="backdrop-cosmos" aria-hidden="true" />
        <div className="starfield-css" aria-hidden="true" style={skyStyle} />
        <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-4 py-16 text-center sm:px-8">
          <a
            href={withBasePath(localizedPath(defaultLocale, '/'))}
            className="mb-10 inline-flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-ink transition-colors duration-150 hover:bg-white/[0.04] active:bg-white/[0.08]"
          >
            <NodeMark className="size-6" />
            <span className="font-display text-[0.8125rem] font-medium tracking-[0.22em]">
              {siteConfig.studioName}
            </span>
          </a>

          <h1 className="font-display text-[7.5rem] leading-none font-medium tracking-[-0.02em] text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.22)] sm:text-[11rem]">
            404
          </h1>
          <p aria-hidden="true" className="mt-4 mono-index tracking-[0.3em] text-faint">
            ERR 404
          </p>

          <ul className="mt-12 grid w-full gap-4 md:grid-cols-3">
            {locales.map((locale) => {
              const texts = getMessagesFor(locale).notFound;
              return (
                <li
                  key={locale}
                  lang={locale}
                  className="corner-brackets flex flex-col items-center gap-3 bg-[rgb(10_14_28/0.72)] px-5 py-6 backdrop-blur-md supports-[not(backdrop-filter:blur(1px))]:bg-[rgb(10_14_28/0.92)]"
                >
                  <span aria-hidden="true" className="mono-index text-faint">
                    {LOCALE_CODES[locale]}
                  </span>
                  <h2 className="font-display text-lg leading-tight font-medium text-balance text-ink">
                    {bindShortWords(texts.title, locale)}
                  </h2>
                  <p className="mb-1 text-sm text-balance text-muted">
                    {bindShortWords(texts.body, locale)}
                  </p>
                  <a
                    href={withBasePath(localizedPath(locale, '/'))}
                    hrefLang={locale}
                    className="mt-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm text-ink transition-colors duration-150 hover:border-white/40 hover:bg-white/5 active:bg-white/10"
                  >
                    <span aria-hidden="true">←</span>
                    {texts.home}
                  </a>
                </li>
              );
            })}
          </ul>
        </main>
      </body>
    </html>
  );
}
