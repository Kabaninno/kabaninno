import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCategories, getCategory, getProjectsForService, getService } from '~/content';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { Breadcrumbs } from '@/components/panel/Breadcrumbs';
import { ContentPanel } from '@/components/panel/ContentPanel';
import { RequestToggle } from '@/components/request/RequestToggle';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { getCategoryText, getProjectText, getServiceText } from '@/lib/content-text';
import { buildPageMetadata } from '@/lib/metadata';
import { serviceRef } from '@/lib/request-draft';
import { paths } from '@/lib/routes';
import { timelineDisplay } from '@/lib/timeline';
import { sceneNodeId } from '@/scene/node-ids';
import { accentStyle, formatIndex } from '@/lib/style';

interface ServicePageProps {
  params: Promise<{ locale: string; category: string; service: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getCategories().flatMap((category) =>
    category.services.map((service) => ({ category: category.id, service: service.slug })),
  );
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { locale, category: categoryId, service: slug } = await params;
  if (!isLocale(locale) || !getService(categoryId, slug)) return {};
  const text = getServiceText(locale, categoryId, slug);
  const categoryName = getCategoryText(locale, categoryId).name;
  return buildPageMetadata({
    locale,
    path: paths.service(categoryId, slug),
    title: `${text.title} · ${categoryName}`,
    description: text.seoDescription,
  });
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { locale, category: categoryId, service: slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const category = getCategory(categoryId);
  const service = getService(categoryId, slug);
  if (!category || !service) notFound();

  const t = await getTranslations('service');
  const tCommon = await getTranslations('common');
  const categoryText = getCategoryText(locale, category.id);
  const text = getServiceText(locale, category.id, service.slug);
  const timeline = timelineDisplay(service.timelineDays);

  const siblings = category.services;
  const position = siblings.findIndex((item) => item.slug === service.slug);
  // Planets orbit, so previous/next wrap around the system.
  const previous = siblings[(position - 1 + siblings.length) % siblings.length]!;
  const next = siblings[(position + 1) % siblings.length]!;
  const related = getProjectsForService(category.id, service.slug);
  const ref = serviceRef(category.id, service.slug);

  return (
    <ContentPanel
      labelledBy="service-title"
      style={accentStyle(category.dna.color)}
      siblings={{
        previous: paths.service(category.id, previous.slug),
        next: paths.service(category.id, next.slug),
      }}
    >
      <Breadcrumbs
        label={tCommon('breadcrumbs')}
        items={[
          { label: tCommon('backToUniverse'), href: paths.home() },
          { label: categoryText.name, href: paths.category(category.id) },
          { label: text.title },
        ]}
      />
      <p className="flex items-center gap-2 mono-index text-muted">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"
        />
        {formatIndex(position + 1)} / {formatIndex(siblings.length)}
      </p>
      <h1
        id="service-title"
        className="mt-3 font-display text-title leading-tight font-medium text-ink md:text-title-lg"
      >
        {text.title}
      </h1>
      <p className="mt-3 text-body leading-relaxed text-ink/90">{text.summary}</p>

      <RequestToggle
        serviceRef={ref}
        fallbackHref={{ pathname: paths.configurator(), query: { add: ref } }}
        labels={{
          add: t('addToRequest'),
          addedStatus: t('requestAddedStatus', { service: text.title }),
          removedStatus: t('requestRemovedStatus', { service: text.title }),
          goTo: t('goToRequest'),
        }}
      />

      <div className="mt-8 flex flex-col gap-6">
        <section>
          <h2 className="mb-2 eyebrow">{t('audience')}</h2>
          <p className="text-body leading-relaxed text-muted">{text.audience}</p>
        </section>
        <section>
          <h2 className="mb-2 eyebrow">{t('features')}</h2>
          <ul className="flex flex-col gap-2">
            {text.features.map((feature) => (
              <li key={feature} className="flex gap-3 text-body text-ink/90">
                <span
                  aria-hidden="true"
                  className="mt-[0.6em] h-0.5 w-3 shrink-0 rounded-full bg-[var(--accent)] opacity-80"
                />
                {feature}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 eyebrow">{t('example')}</h2>
          <p className="border-l border-[color-mix(in_srgb,var(--accent)_50%,transparent)] pl-4 text-body leading-relaxed text-muted">
            {text.example}
          </p>
        </section>
        <section>
          <h2 className="mb-2 eyebrow">{t('timeline')}</h2>
          <p className="font-display text-lg text-ink">{t('timelineValue', { ...timeline })}</p>
          <p className="mt-1 text-xs text-muted">{t('timelineNote')}</p>
        </section>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="mt-8">
          <h2 id="related-title" className="mb-3 eyebrow">
            {t('relatedProjects')}
          </h2>
          <ul className="flex flex-col gap-2">
            {related.map((project) => (
              <li key={project.slug}>
                <Link
                  href={paths.project(project.slug)}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.07] px-4 py-2 text-sm text-ink transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.04] active:bg-white/[0.07]"
                >
                  {getProjectText(locale, project.slug).title}
                  <span aria-hidden="true" className="text-faint">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-labelledby="siblings-title" className="mt-8 border-t border-white/[0.07] pt-6">
        <h2 id="siblings-title" className="mb-3 eyebrow">
          {t('siblings')}
        </h2>
        <ol className="flex flex-col">
          {siblings.map((sibling, index) => {
            const current = sibling.slug === service.slug;
            return (
              <li key={sibling.slug}>
                <HighlightLink
                  href={paths.service(category.id, sibling.slug)}
                  highlightId={sceneNodeId.service(category.id, sibling.slug)}
                  aria-current={current ? 'page' : undefined}
                  className="group flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-muted transition-colors duration-150 hover:bg-white/[0.04] hover:text-ink active:bg-white/[0.07] aria-[current]:text-ink data-highlighted:bg-white/[0.04] data-highlighted:text-ink"
                >
                  <span
                    aria-hidden="true"
                    className="mono-index text-faint group-aria-[current]:text-[var(--accent)]"
                  >
                    {formatIndex(index + 1)}
                  </span>
                  {getServiceText(locale, category.id, sibling.slug).title}
                </HighlightLink>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <HighlightLink
            href={paths.service(category.id, previous.slug)}
            highlightId={sceneNodeId.service(category.id, previous.slug)}
            rel="prev"
            className="flex min-h-14 flex-col justify-start rounded-xl border border-white/[0.07] px-3 py-2 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-offset-[-1px] active:bg-white/[0.07]"
          >
            <span className="text-xs text-muted">
              <span aria-hidden="true">← </span>
              {t('previous')}
            </span>
            <span className="line-clamp-2 text-sm leading-snug text-ink">
              {getServiceText(locale, category.id, previous.slug).title}
            </span>
          </HighlightLink>
          <HighlightLink
            href={paths.service(category.id, next.slug)}
            highlightId={sceneNodeId.service(category.id, next.slug)}
            rel="next"
            className="flex min-h-14 flex-col items-end justify-start rounded-xl border border-white/[0.07] px-3 py-2 text-right transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-offset-[-1px] active:bg-white/[0.07]"
          >
            <span className="text-xs text-muted">
              {t('next')}
              <span aria-hidden="true"> →</span>
            </span>
            <span className="line-clamp-2 max-w-full text-sm leading-snug text-ink">
              {getServiceText(locale, category.id, next.slug).title}
            </span>
          </HighlightLink>
        </div>
      </nav>
    </ContentPanel>
  );
}
