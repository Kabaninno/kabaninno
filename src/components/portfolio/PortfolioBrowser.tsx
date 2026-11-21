'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { Link } from '@/i18n/navigation';
import {
  CATEGORY_PARAM,
  emphasisForFilter,
  filterProjects,
  parseCategoryFilter,
} from '@/lib/portfolio';
import { paths } from '@/lib/routes';
import { accentStyle } from '@/lib/style';
import { sceneNodeId } from '@/scene/node-ids';
import { useSceneStore } from '@/store/scene';

/** A case card, prepared on the server (texts resolved, no content import here). */
export interface PortfolioCardData {
  slug: string;
  title: string;
  summary: string;
  year: number;
  stack: string[];
  categories: string[];
  /** "Strony i aplikacje, Boty Telegram" for screen readers. */
  categoryNames: string;
  /** DNA colors of the categories (first one is the card accent). */
  colors: string[];
  draft: boolean;
}

export interface PortfolioFilterData {
  id: string;
  name: string;
  color: string;
}

interface PortfolioBrowserProps {
  cards: PortfolioCardData[];
  filters: PortfolioFilterData[];
  labels: {
    filterLabel: string;
    all: string;
    draft: string;
    /** Result count text by number of visible cases (0…cards.length). */
    counts: string[];
  };
}

/**
 * The portfolio index (BRIEF «Портфоліо»): a category filter and object-cards.
 * - The filter lives in the URL (`?category=web`): plain links, so it works
 *   without JavaScript too (the static page then simply lists everything);
 *   with it, the links replace the history entry (no Back through filters)
 *   and Back/Forward from a case restore the filter with the URL.
 * - Static export has no request-time query, so the query is read on the
 *   client (`useSearchParams` under Suspense); the server HTML is the
 *   unfiltered list.
 * - The visible count is a polite live region; hover/focus on a card lights
 *   its object in the scene; the filtered cases are the scene emphasis (D87),
 *   cleared when leaving the route.
 */
export function PortfolioBrowser(props: PortfolioBrowserProps) {
  return (
    <Suspense fallback={<PortfolioView {...props} category={null} />}>
      <PortfolioWithQuery {...props} />
    </Suspense>
  );
}

function PortfolioWithQuery(props: PortfolioBrowserProps) {
  const query = useSearchParams();
  const category = parseCategoryFilter(
    query.get(CATEGORY_PARAM),
    props.filters.map((filter) => filter.id),
  );

  useEffect(() => {
    useSceneStore.getState().setEmphasis(emphasisForFilter(props.cards, category));
  }, [props.cards, category]);
  useEffect(() => () => useSceneStore.getState().setEmphasis([]), []);

  return <PortfolioView {...props} category={category} />;
}

const chip =
  'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors duration-150 ease-calm md:min-h-9 md:pointer-coarse:min-h-11 ' +
  'border-white/10 text-muted hover:border-[color-mix(in_srgb,var(--accent,white)_45%,transparent)] hover:text-ink active:bg-white/[0.07] ' +
  'aria-[current=true]:border-[color-mix(in_srgb,var(--accent,white)_70%,transparent)] aria-[current=true]:bg-[color-mix(in_srgb,var(--accent,white)_12%,transparent)] aria-[current=true]:text-ink';

function PortfolioView({
  cards,
  filters,
  labels,
  category,
}: PortfolioBrowserProps & { category: string | null }) {
  const visible = filterProjects(cards, category);

  return (
    <div className="mt-7">
      {filters.length > 1 ? (
        <nav aria-label={labels.filterLabel}>
          <ul className="flex flex-wrap gap-1.5">
            <li>
              <Link
                href={paths.portfolio()}
                replace
                scroll={false}
                aria-current={category === null ? 'true' : undefined}
                className={chip}
              >
                {labels.all}
              </Link>
            </li>
            {filters.map((filter) => (
              <li key={filter.id} style={accentStyle(filter.color)}>
                <Link
                  href={{ pathname: paths.portfolio(), query: { [CATEGORY_PARAM]: filter.id } }}
                  replace
                  scroll={false}
                  aria-current={category === filter.id ? 'true' : undefined}
                  className={chip}
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                  />
                  {filter.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <p role="status" className="mt-4 mono-index text-faint">
        {labels.counts[visible.length]}
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {visible.map((card) => (
          <li key={card.slug}>
            <HighlightLink
              href={paths.project(card.slug)}
              highlightId={sceneNodeId.project(card.slug)}
              style={accentStyle(card.colors[0] ?? '#E8ECF5')}
              className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl glass p-4 transition-[border-color,background-color] duration-200 ease-calm hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-[rgb(10_14_28/0.8)] focus-visible:border-[var(--accent)] focus-visible:outline-offset-[-1px] active:bg-[rgb(10_14_28/0.9)]"
            >
              {/* Accent hairline: the object's signal color. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] opacity-60 transition-opacity group-hover:opacity-100"
              />
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  {card.colors.map((color, index) => (
                    <span
                      key={`${color}-${index}`}
                      style={accentStyle(color)}
                      className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    />
                  ))}
                </span>
                <span className="sr-only">{card.categoryNames}</span>
                <span className="flex items-center gap-2">
                  {card.draft ? (
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[0.6875rem] text-muted">
                      {labels.draft}
                    </span>
                  ) : null}
                  <span className="mono-index text-muted">{card.year}</span>
                </span>
              </span>
              <span className="font-display text-base font-medium text-ink">{card.title}</span>
              <span className="line-clamp-2 text-sm leading-relaxed text-muted">
                {card.summary}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {card.stack.slice(0, 4).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[0.6875rem] text-ink/80"
                  >
                    {item}
                  </span>
                ))}
              </span>
            </HighlightLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
