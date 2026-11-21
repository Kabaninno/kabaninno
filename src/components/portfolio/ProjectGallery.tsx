import { getTranslations } from 'next-intl/server';
import type { Project } from '~/content';
import { withBasePath } from '@/lib/base-path';

/**
 * Case gallery: lazy images with explicit dimensions (no layout shift), base
 * path aware (`withBasePath`; next/image would not add the base path to a
 * string `src` with `images.unoptimized`). Alt texts name the case and the
 * position; dedicated captions can come from content later.
 */
export async function ProjectGallery({
  gallery,
  title,
}: {
  gallery: Project['gallery'];
  title: string;
}) {
  if (gallery.length === 0) return null;
  const t = await getTranslations('portfolio');
  return (
    <section aria-labelledby="project-gallery">
      <h2 id="project-gallery" className="mb-3 eyebrow">
        {t('gallery')}
      </h2>
      <ul className="grid grid-cols-2 gap-2">
        {gallery.map((item, index) => (
          <li
            key={item.src}
            className={index === 0 && gallery.length % 2 === 1 ? 'col-span-2' : ''}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, see above */}
            <img
              src={withBasePath(item.src)}
              width={item.width}
              height={item.height}
              loading="lazy"
              decoding="async"
              alt={t('galleryImage', { title, index: index + 1, total: gallery.length })}
              className="h-auto w-full rounded-xl border border-white/[0.08] bg-deep"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
