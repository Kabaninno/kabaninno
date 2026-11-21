import { HighlightLink } from '@/components/nav/HighlightLink';
import type { NavCategory } from '@/lib/nav';
import { paths } from '@/lib/routes';
import { accentStyle, formatIndex } from '@/lib/style';
import { PALETTE } from '@/scene/config';
import { sceneNodeId } from '@/scene/node-ids';

interface CategoryIndexProps {
  /** Visible hint above the index; also the navigation's accessible name. */
  hint: string;
  /** Accessible name of the list of service categories. */
  categoriesLabel: string;
  categories: readonly NavCategory[];
  portfolioLabel: string;
  configuratorLabel: string;
}

const HINT_ID = 'home-explore';

/** Glass chip on phones, quiet right-aligned link from md up. */
const ITEM_LINK =
  'group flex min-h-11 items-center gap-2.5 rounded-full glass px-3.5 text-sm text-ink transition-[background-color,border-color,color] duration-200 ease-calm ' +
  'hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-[rgb(10_14_28/0.8)] data-highlighted:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] data-highlighted:bg-[rgb(10_14_28/0.8)] focus-visible:outline-offset-[-1px] active:bg-[rgb(10_14_28/0.9)] ' +
  'md:border-transparent md:bg-transparent md:px-3 md:text-muted md:text-halo md:[backdrop-filter:none] md:hover:bg-[rgb(10_14_28/0.55)] md:hover:text-ink md:data-highlighted:bg-[rgb(10_14_28/0.55)] md:data-highlighted:text-ink md:pointer-fine:min-h-9 ' +
  'short:gap-2 short:px-2.5 short:text-[0.8125rem]';

/**
 * Keyboard and screen-reader map of the universe: all seven nodes as real
 * links, reachable with Tab. Hover/focus highlights the matching node in the
 * scene (HighlightLink). Marked as a scene overlay, so the camera keeps the
 * network out from under it.
 *
 * - The hint (`home.explore`) names the navigation and is shown from md up;
 *   phones and short viewports keep it for screen readers only.
 * - 01–05: the service systems (from content). Then the portfolio cluster
 *   and the configurator beacon, set apart on md+ by a hairline that fades in
 *   from the left and stops at the column of dots (a callout line).
 * - Phones: wrapping glass chips without the mono numbers (three rows for all
 *   seven nodes leave the network more room). md+: a right-aligned column of
 *   quiet links with "01"–"05", 36 px tall for a mouse (44 px on touch), so
 *   the column stays low and the universe gets more room (V2-02).
 * - Short viewports (landscape phones): one compact row of the five systems
 *   under the hero; the mono numbers are dropped below md so they fit. The
 *   portfolio and configurator entries are left out there for space; the
 *   HUD links and the hero CTA lead to (and highlight) the same nodes.
 */
export function CategoryIndex({
  hint,
  categoriesLabel,
  categories,
  portfolioLabel,
  configuratorLabel,
}: CategoryIndexProps) {
  return (
    <nav
      aria-labelledby={HINT_ID}
      data-scene-overlay=""
      className="pointer-events-auto flex flex-col gap-1.5 md:items-end md:gap-1"
    >
      <p id={HINT_ID} className="eyebrow max-md:sr-only md:px-3 md:pb-1 short:sr-only">
        {hint}
      </p>
      <ol
        aria-label={categoriesLabel}
        className="flex flex-wrap gap-1.5 md:flex-col md:items-end md:gap-0.5 short:flex-row short:items-center short:gap-1"
      >
        {categories.map((category) => (
          <li key={category.id} style={accentStyle(category.color)}>
            <HighlightLink
              href={paths.category(category.id)}
              highlightId={sceneNodeId.category(category.id)}
              className={ITEM_LINK}
            >
              <span
                aria-hidden="true"
                className="mono-index text-faint group-hover:text-[var(--accent)] group-data-highlighted:text-[var(--accent)] max-sm:hidden short:max-md:hidden"
              >
                {formatIndex(category.index)}
              </span>
              <span>{category.name}</span>
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] transition-transform duration-200 group-hover:scale-150 group-data-highlighted:scale-150"
              />
            </HighlightLink>
          </li>
        ))}
      </ol>
      <ul className="flex flex-wrap gap-1.5 md:mt-1 md:flex-col md:items-end md:gap-0.5 md:bg-[linear-gradient(to_right,transparent,rgb(255_255_255/0.12)_60%,rgb(255_255_255/0.12)_calc(100%-0.875rem),transparent_calc(100%-0.875rem))] md:bg-[length:100%_1px] md:bg-top md:bg-no-repeat md:pt-1.5 short:hidden">
        <li style={accentStyle(PALETTE.portfolio)}>
          <HighlightLink
            href={paths.portfolio()}
            highlightId={sceneNodeId.portfolio}
            className={ITEM_LINK}
          >
            <span>{portfolioLabel}</span>
            {/* Silver cluster: a dot with a faint halo. */}
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_0_2.5px_color-mix(in_srgb,var(--accent)_14%,transparent),0_0_10px_var(--accent)] transition-transform duration-200 group-hover:scale-150 group-data-highlighted:scale-150"
            />
          </HighlightLink>
        </li>
        <li style={accentStyle('var(--color-brand)')}>
          <HighlightLink
            href={paths.configurator()}
            highlightId={sceneNodeId.configurator}
            className={ITEM_LINK}
          >
            <span>{configuratorLabel}</span>
            {/* Beacon: an outlined diamond. */}
            <span
              aria-hidden="true"
              className="size-[0.4375rem] rotate-45 border border-[var(--accent)] shadow-[0_0_8px_var(--accent)] transition-transform duration-200 group-hover:scale-150 group-hover:rotate-[135deg] group-data-highlighted:scale-150 group-data-highlighted:rotate-[135deg]"
            />
          </HighlightLink>
        </li>
      </ul>
    </nav>
  );
}
