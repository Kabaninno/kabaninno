import { getTranslations } from 'next-intl/server';
import { getCategories, getCategory, type Project } from '~/content';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { ContentPanel } from '@/components/panel/ContentPanel';
import { ctaArrow, primaryButton } from '@/components/ui/styles';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getCategoryText, getProjectText } from '@/lib/content-text';
import { buildNavCategories } from '@/lib/nav-data';
import { filterOptions } from '@/lib/portfolio';
import { paths } from '@/lib/routes';
import { accentStyle, formatIndex } from '@/lib/style';
import { bindShortWords } from '@/lib/typography';
import { sceneNodeId } from '@/scene/node-ids';
// Single source of the portfolio cluster color (shared with the 3D scene).
import { PALETTE } from '@/scene/config';
import { PortfolioBrowser } from './PortfolioBrowser';

interface PortfolioIndexProps {
  locale: Locale;
  /** Projects visible in this build (drafts only in dev / SHOW_DRAFTS builds, D12). */
  projects: readonly Project[];
}

/**
 * Portfolio list (category filter + object-cards, `PortfolioBrowser`), or the
 * "coming soon" state when no case is visible. The empty state (what
 * production ships until cases are published) always offers a next step: the
 * configurator and the service systems (from content data). Card data, filter
 * names and count texts are prepared here, on the server.
 */
export async function PortfolioIndex({ locale, projects }: PortfolioIndexProps) {
  const t = await getTranslations('portfolio');

  return (
    <ContentPanel labelledBy="portfolio-title" style={accentStyle(PALETTE.portfolio)}>
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1
        id="portfolio-title"
        className="mt-3 font-display text-title-md leading-tight font-medium text-ink md:text-title-xl"
      >
        {t('title')}
      </h1>
      <p className="mt-3 text-body leading-relaxed text-muted">
        {bindShortWords(t('lead'), locale)}
      </p>

      {projects.length === 0 ? (
        <EmptyState locale={locale} />
      ) : (
        <PortfolioBrowser
          cards={projects.map((project) => {
            const text = getProjectText(locale, project.slug);
            return {
              slug: project.slug,
              title: text.title,
              summary: text.summary,
              year: project.year,
              stack: [...project.stack],
              categories: [...project.categories],
              categoryNames: project.categories
                .map((id) => getCategoryText(locale, id).name)
                .join(', '),
              colors: project.categories.map((id) => getCategory(id)?.dna.color ?? '#E8ECF5'),
              draft: project.status === 'draft',
            };
          })}
          filters={filterOptions(
            projects,
            getCategories().map((category) => category.id),
          ).map((option) => ({
            id: option.id,
            name: getCategoryText(locale, option.id).name,
            color: getCategory(option.id)?.dna.color ?? '#E8ECF5',
          }))}
          labels={{
            filterLabel: t('filterLabel'),
            all: t('filterAll'),
            draft: t('draftBadge'),
            counts: Array.from({ length: projects.length + 1 }, (_, count) =>
              t('resultCount', { count }),
            ),
          }}
        />
      )}
    </ContentPanel>
  );
}

async function EmptyState({ locale }: { locale: Locale }) {
  const t = await getTranslations('portfolio');
  const categories = buildNavCategories(locale);

  return (
    <div className="mt-7">
      <div className="corner-brackets bg-white/[0.025] px-5 py-6">
        <p aria-hidden="true" className="flex items-center gap-2 mono-index text-[var(--accent)]">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] motion-reduce:animate-none" />
          00 / 00
        </p>
        <h2 className="mt-3 font-display text-lg font-medium text-ink">{t('emptyTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {bindShortWords(t('emptyBody'), locale)}
        </p>
        <Link
          href={paths.configurator()}
          className={`${primaryButton} mt-5 min-h-12 w-full px-6 text-sm sm:w-auto`}
        >
          {t('emptyCta')}
          <span aria-hidden="true" className={ctaArrow}>
            →
          </span>
        </Link>
      </div>

      <nav aria-labelledby="portfolio-explore" className="mt-6">
        <h2 id="portfolio-explore" className="mb-3 eyebrow">
          {t('emptyExplore')}
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <li key={category.id} style={accentStyle(category.color)}>
              <HighlightLink
                href={paths.category(category.id)}
                highlightId={sceneNodeId.category(category.id)}
                className="group flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-3.5 text-sm text-muted transition-colors duration-150 ease-calm hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-white/[0.04] hover:text-ink focus-visible:border-[var(--accent)] active:bg-white/[0.07]"
              >
                <span
                  aria-hidden="true"
                  className="mono-index text-faint group-hover:text-[var(--accent)]"
                >
                  {formatIndex(category.index)}
                </span>
                {category.name}
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                />
              </HighlightLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
