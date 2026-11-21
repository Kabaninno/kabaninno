'use client';

import { useEffect, useRef, useState } from 'react';
import { primaryButton } from '@/components/ui/styles';
import { iframeDemoAttributes } from '@/lib/portfolio';

interface IframeDemoProps {
  url: string;
  aspectRatio: number;
  labels: {
    /** "Live demo: <case title>" (also the iframe's accessible name). */
    frameTitle: string;
    load: string;
    /** "The external page (example.com) loads only after you click." */
    hint: string;
    host: string;
    open: string;
    newTab: string;
  };
}

/**
 * Live demo embed with a click-to-load facade: nothing from the external site
 * is requested until the visitor asks for it (privacy, performance). Then a
 * lazy, sandboxed iframe without referrer at the stored aspect ratio takes the
 * facade's place and receives focus. "Open in a new tab" is always there.
 */
export function IframeDemo({ url, aspectRatio, labels }: IframeDemoProps) {
  const [loaded, setLoaded] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (loaded) frameRef.current?.focus();
  }, [loaded]);

  return (
    <div>
      {loaded ? (
        <iframe
          ref={frameRef}
          {...iframeDemoAttributes({ url, aspectRatio }, labels.frameTitle)}
          className="w-full rounded-2xl border border-white/10 bg-white"
        />
      ) : (
        <div
          style={{ aspectRatio: String(aspectRatio) }}
          className="relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(120%_90%_at_30%_20%,color-mix(in_srgb,var(--accent,var(--color-brand))_22%,transparent),transparent_60%),linear-gradient(160deg,#0a1024,#05070d)] p-5 text-center"
        >
          {/* A schematic browser window, purely decorative. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-6 top-5 flex h-6 items-center gap-1.5 rounded-t-lg border border-white/10 bg-white/[0.03] px-2.5"
          >
            <span className="size-1.5 rounded-full bg-white/25" />
            <span className="size-1.5 rounded-full bg-white/25" />
            <span className="size-1.5 rounded-full bg-white/25" />
          </span>
          <p className="mono-index text-muted">{labels.host}</p>
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className={`${primaryButton} min-h-11 px-5 text-sm`}
          >
            <span aria-hidden="true">▶</span>
            {labels.load}
          </button>
          <p className="max-w-xs text-xs leading-relaxed text-muted">{labels.hint}</p>
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-sm text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink active:text-white"
      >
        {labels.open}
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> ({labels.newTab})</span>
      </a>
    </div>
  );
}
