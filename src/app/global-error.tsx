'use client';

import { useSyncExternalStore } from 'react';
import { defaultLocale, isLocale, type Locale } from '@/i18n/routing';
import { BASE_PATH, withBasePath } from '@/lib/base-path';
import { fontVariables } from './fonts';
import './globals.css';

interface ErrorTexts {
  eyebrow: string;
  title: string;
  body: string;
  retry: string;
  home: string;
}

/*
 * This component is part of every page's base JS chunk, so it must not import
 * the dictionaries (that would ship every ui.json to every page). The `error`
 * namespace of each `messages/<locale>/ui.json` is inlined at build time
 * instead (`GLOBAL_ERROR_TEXTS` in next.config.ts).
 */
const TEXTS = JSON.parse(process.env.GLOBAL_ERROR_TEXTS ?? '{}') as Partial<
  Record<Locale, ErrorTexts>
>;

const subscribeNever = () => () => {};

function localeFromLocation(): Locale {
  const path = window.location.pathname.slice(BASE_PATH.length);
  const segment = path.split('/').find(Boolean);
  return isLocale(segment) ? segment : defaultLocale;
}

/**
 * Last-resort error screen: replaces the whole document when the locale layout
 * itself fails (page-level errors are handled by `[locale]/error.tsx` with the
 * HUD still in place). Minimal and dependency-free; "home" is a plain link, so
 * it also recovers from a broken client router (e.g. stale chunks after a
 * redeploy).
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const locale = useSyncExternalStore(subscribeNever, localeFromLocation, () => defaultLocale);
  const texts = TEXTS[locale] ?? TEXTS[defaultLocale];

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        {/*
         * This document replaces the page's <head>, metadata icons included.
         * Without an explicit icon the browser requests /favicon.ico at the
         * origin root, outside the base path (QA M1-2 N5). React hoists the
         * link into <head>.
         */}
        <link rel="icon" href={withBasePath('/icon.svg')} type="image/svg+xml" sizes="any" />
        <div className="backdrop-cosmos" aria-hidden="true" />
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          {texts ? (
            <>
              <title>{texts.title}</title>
              <p className="eyebrow">{texts.eyebrow}</p>
              <h1 className="font-display text-2xl leading-tight font-medium text-balance text-ink">
                {texts.title}
              </h1>
              <p className="text-sm text-balance text-muted">{texts.body}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => retry()}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-medium text-void transition-colors duration-200 hover:bg-white active:bg-white/85"
                >
                  {texts.retry}
                </button>
                <a
                  href={withBasePath(`/${locale}/`)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-6 text-sm text-ink transition-colors duration-200 hover:border-white/35 hover:bg-white/[0.06] active:bg-white/10"
                >
                  <span aria-hidden="true">←</span>
                  {texts.home}
                </a>
              </div>
            </>
          ) : null}
        </main>
      </body>
    </html>
  );
}
