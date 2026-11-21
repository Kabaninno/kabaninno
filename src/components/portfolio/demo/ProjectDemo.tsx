import { getTranslations } from 'next-intl/server';
import type { ProjectDemo as ProjectDemoData } from '~/content';
import type { Locale } from '@/i18n/routing';
import { withBasePath } from '@/lib/base-path';
import { buildMockupLabels } from '@/lib/mockups';
import { demoHost } from '@/lib/portfolio';
import { IframeDemo } from './IframeDemo';
import { MockupDemo } from './Mockups';

interface ProjectDemoProps {
  demo: ProjectDemoData;
  /** Case title (accessible names of the iframe and the video). */
  title: string;
  locale: Locale;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The case's interactive demo, by `project.demo.type` (BRIEF: live iframe,
 * video or interactive mockup; the data supports all three). Labels are
 * resolved here, on the server.
 * - iframe: click-to-load facade, then a lazy sandboxed iframe (`IframeDemo`).
 * - video: `preload="none"`, poster, controls, muted and inline; it never
 *   autoplays (no surprise motion or data use, reduced motion included).
 * - mockup: the HTML/CSS mockup of the variant (`MockupDemo`).
 */
export async function ProjectDemo({ demo, title, locale }: ProjectDemoProps) {
  const t = await getTranslations('portfolio');

  let body;
  switch (demo.type) {
    case 'iframe':
      body = (
        <IframeDemo
          url={demo.url}
          aspectRatio={demo.aspectRatio}
          labels={{
            frameTitle: t('demoFrameTitle', { title }),
            load: t('demoLoad'),
            hint: t('demoLoadHint', { host: demoHost(demo.url) }),
            host: demoHost(demo.url),
            open: t('demoOpen'),
            newTab: t('newTab'),
          }}
        />
      );
      break;
    case 'video':
      body = (
        <video
          src={withBasePath(demo.src)}
          poster={demo.poster ? withBasePath(demo.poster) : undefined}
          preload="none"
          controls
          muted
          playsInline
          aria-label={t('demoVideo', { title })}
          className="w-full rounded-2xl border border-white/10 bg-black"
        />
      );
      break;
    case 'mockup':
      body = (
        <>
          <p className="mb-3 text-sm text-muted">{t('demoMockupHint')}</p>
          <MockupDemo
            variant={demo.variant}
            labels={buildMockupLabels(
              locale,
              t as unknown as Translate,
              (key) => t.raw(key as never) as string,
            )}
          />
        </>
      );
      break;
  }

  return (
    <section aria-labelledby="project-demo">
      <h2 id="project-demo" className="mb-3 eyebrow">
        {t('demo')}
      </h2>
      {body}
    </section>
  );
}
