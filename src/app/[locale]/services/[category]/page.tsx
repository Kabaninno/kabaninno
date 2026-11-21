import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCategories, getCategory } from '~/content';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { Breadcrumbs } from '@/components/panel/Breadcrumbs';
import { ContentPanel } from '@/components/panel/ContentPanel';
import { isLocale } from '@/i18n/routing';
import { getCategoryText, getServiceText } from '@/lib/content-text';
import { buildPageMetadata } from '@/lib/metadata';
import { paths } from '@/lib/routes';
import { sceneNodeId } from '@/scene/node-ids';
import { accentStyle, formatIndex } from '@/lib/style';

interface CategoryPageProps {
  params: Promise<{ locale: string; category: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getCategories().map((category) => ({ category: category.id }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, category: categoryId } = await params;
  if (!isLocale(locale) || !getCategory(categoryId)) return {};
  const text = getCategoryText(locale, categoryId);
  return buildPageMetadata({
    locale,
    path: paths.category(categoryId),
    title: text.name,
    description: text.seoDescription,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { locale, category: categoryId } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const category = getCategory(categoryId);
  if (!category) notFound();

  const t = await getTranslations('system');
  const tCommon = await getTranslations('common');
  const categories = getCategories();
  const position = categories.findIndex((item) => item.id === category.id) + 1;
  const text = getCategoryText(locale, category.id);
  const services = category.services;
  // ←/→ and swipe from the system: → to the first planet, ← to the last. This
  // enters a planet like a click on it, so it pushes (Back returns here).
  const siblings = {
    previous: paths.service(category.id, services[services.length - 1]!.slug),
    next: paths.service(category.id, services[0]!.slug),
    history: 'push' as const,
  };

  return (
    <ContentPanel
      labelledBy="category-title"
      style={accentStyle(category.dna.color)}
      siblings={siblings}
    >
      <Breadcrumbs
        label={tCommon('breadcrumbs')}
        items={[{ label: tCommon('backToUniverse'), href: paths.home() }, { label: text.name }]}
      />
      <p className="flex items-center gap-2 eyebrow">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"
        />
        {t('eyebrow', {
          index: formatIndex(position),
          total: formatIndex(categories.length),
        })}
      </p>
      <h1
        id="category-title"
        className="mt-3 font-display text-[1.75rem] leading-tight font-medium text-ink md:text-[2rem]"
      >
        {text.name}
      </h1>
      <p className="mt-2 text-base text-[color-mix(in_srgb,var(--accent)_70%,var(--color-ink))]">
        {text.tagline}
      </p>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">{text.description}</p>

      <h2 className="mt-8 mb-3 eyebrow">{t('servicesHeading')}</h2>
      <ol className="flex flex-col gap-2">
        {category.services.map((service, index) => {
          const serviceText = getServiceText(locale, category.id, service.slug);
          return (
            <li key={service.slug}>
              <HighlightLink
                href={paths.service(category.id, service.slug)}
                highlightId={sceneNodeId.service(category.id, service.slug)}
                className="group flex gap-4 rounded-2xl border border-white/[0.07] p-4 transition-colors duration-200 ease-calm hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-white/[0.04] focus-visible:outline-offset-[-1px] active:bg-white/[0.07]"
              >
                <span
                  aria-hidden="true"
                  className="pt-1 mono-index text-faint group-hover:text-[var(--accent)]"
                >
                  {formatIndex(index + 1)}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-display text-[0.9375rem] font-medium text-ink">
                    {serviceText.title}
                  </span>
                  <span className="text-sm leading-relaxed text-muted">{serviceText.summary}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="ml-auto self-center text-faint transition-transform duration-200 ease-calm group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                >
                  →
                </span>
              </HighlightLink>
            </li>
          );
        })}
      </ol>
    </ContentPanel>
  );
}
