import { HighlightLink } from '@/components/nav/HighlightLink';
import { ctaArrow, primaryButton } from '@/components/ui/styles';
import type { NavCategory } from '@/lib/nav';
import { paths } from '@/lib/routes';
import { accentStyle } from '@/lib/style';
import { PALETTE } from '@/scene/config';
import { sceneNodeId } from '@/scene/node-ids';

interface CategoryIndexProps {
  /** Visible hint above the index; also the navigation's accessible name. */
  hint: string;
  /** Accessible name of the list of service categories. */
  categoriesLabel: string;
  categories: readonly NavCategory[];
  portfolio: { label: string; caption: string };
  /** The closing call to action (the configurator) and its small note. */
  cta: { label: string; note: string };
}

const HINT_ID = 'home-explore';

/**
 * A category as a button-like card: accent dot, name, one-line caption and a
 * chevron. Pressed state: it sinks a little and its accent border lights up.
 * Phones: glass card in a two-column grid (44 px+ hit area). md+: the same
 * card without the blur (cheaper over the scene), a little taller for a mouse.
 * Short viewports (landscape phones): a compact pill, no caption.
 */
const CARD =
  'group relative flex min-h-11 w-full items-center gap-1.5 rounded-xl glass px-2 py-1.5 text-left text-ink ' +
  'transition-[background-color,border-color,scale] duration-200 ease-calm ' +
  'hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-[rgb(10_14_28/0.8)] ' +
  'data-highlighted:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] data-highlighted:bg-[rgb(10_14_28/0.8)] ' +
  'active:scale-[0.97] active:border-[var(--accent)] active:bg-[rgb(10_14_28/0.92)] focus-visible:outline-offset-[-1px] ' +
  'sm:gap-2.5 sm:px-3 md:min-h-12 md:bg-[rgb(10_14_28/0.58)] md:[backdrop-filter:none] md:pointer-fine:min-h-12 ' +
  'short:min-h-11 short:w-auto short:rounded-full short:px-3.5 short:py-0';

const DOT =
  'size-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] transition-transform duration-200 group-hover:scale-150 group-data-highlighted:scale-150';

/** Chevron: nudges right on hover, highlight and press (transform only). */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0 text-faint transition-[translate,color] duration-200 ease-calm group-hover:translate-x-0.5 group-hover:text-[var(--accent)] group-data-highlighted:translate-x-0.5 group-data-highlighted:text-[var(--accent)] max-sm:hidden short:hidden"
    >
      <path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardText({
  name,
  caption,
  captionId,
}: {
  name: string;
  caption: string;
  captionId: string;
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-body-s leading-tight font-medium text-pretty sm:text-sm">
        {name}
      </span>
      {/* Described-by instead of part of the name keeps the link's name short (D129). */}
      <span
        id={captionId}
        aria-hidden="true"
        className="mt-0.5 block truncate text-label leading-tight text-muted md:text-xs short:hidden"
      >
        {caption}
      </span>
    </span>
  );
}

/**
 * Keyboard and screen-reader map of the universe, and the home page's main
 * navigation: the five systems and the portfolio as button-like cards, then
 * the configurator call to action (a real link too: seven nodes in all).
 * Hover/focus highlights the matching node in the scene (HighlightLink), and
 * the scene's idle tour or hover lights the matching card back. Marked as a
 * scene overlay, so the camera keeps the network out from under it.
 *
 * - The hint (`home.explore`) names the navigation and is shown from md up;
 *   phones and short viewports keep it for screen readers only.
 * - Phones: two columns, so the six cards take three rows and the universe
 *   keeps the area above. md+: one right-aligned column; the portfolio card
 *   is set apart by a hairline.
 * - Order on the page is deliberate: slogan → cards → CTA (services first,
 *   then the request).
 * - Short viewports (landscape phones): one compact row of the five systems
 *   under the hero, then the CTA. The portfolio card is left out there for
 *   space; the HUD link leads to (and highlights) the same node.
 */
export function CategoryIndex({
  hint,
  categoriesLabel,
  categories,
  portfolio,
  cta,
}: CategoryIndexProps) {
  return (
    <nav
      aria-labelledby={HINT_ID}
      data-scene-overlay=""
      className="pointer-events-auto flex flex-col gap-3 md:w-[17.5rem] md:gap-1 short:w-auto short:items-start short:gap-2 md:short:w-auto"
    >
      <p id={HINT_ID} className="eyebrow max-md:sr-only md:px-1 md:pb-1 short:sr-only">
        {hint}
      </p>
      <ul
        aria-label={categoriesLabel}
        className="grid grid-cols-2 gap-1.5 md:grid-cols-1 md:gap-1 short:flex short:flex-row short:flex-wrap short:items-center short:gap-1"
      >
        {categories.map((category) => (
          <li key={category.id} style={accentStyle(category.color)} className="flex">
            <HighlightLink
              href={paths.category(category.id)}
              highlightId={sceneNodeId.category(category.id)}
              aria-describedby={`home-card-${category.id}`}
              className={CARD}
            >
              <span aria-hidden="true" className={DOT} />
              <CardText
                name={category.name}
                caption={category.caption}
                captionId={`home-card-${category.id}`}
              />
              <Chevron />
            </HighlightLink>
          </li>
        ))}
        <li
          style={accentStyle(PALETTE.portfolio)}
          className="flex md:mt-1.5 md:bg-[linear-gradient(to_right,transparent,rgb(255_255_255/0.12)_60%,rgb(255_255_255/0.12)_calc(100%-0.875rem),transparent_calc(100%-0.875rem))] md:bg-[length:100%_1px] md:bg-top md:bg-no-repeat md:pt-1.5 short:hidden"
        >
          <HighlightLink
            href={paths.portfolio()}
            highlightId={sceneNodeId.portfolio}
            aria-describedby="home-card-portfolio"
            className={CARD}
          >
            {/* Silver cluster: a dot with a faint halo. */}
            <span
              aria-hidden="true"
              className={`${DOT} shadow-[0_0_0_2.5px_color-mix(in_srgb,var(--accent)_14%,transparent),0_0_10px_var(--accent)]`}
            />
            <CardText
              name={portfolio.label}
              caption={portfolio.caption}
              captionId="home-card-portfolio"
            />
            <Chevron />
          </HighlightLink>
        </li>
      </ul>
      {/* The configurator beacon, as the closing action; lights its node up like the cards. */}
      <div
        className="flex flex-col items-stretch gap-1.5 md:mt-2 short:mt-0 short:items-start short:gap-1"
        style={accentStyle('var(--color-brand)')}
      >
        <HighlightLink
          href={paths.configurator()}
          highlightId={sceneNodeId.configurator}
          aria-describedby="home-cta-note"
          className={`${primaryButton} min-h-12 px-6 text-sm short:min-h-11 short:px-5`}
        >
          {cta.label}
          <span aria-hidden="true" className={ctaArrow}>
            →
          </span>
        </HighlightLink>
        <p id="home-cta-note" className="text-center text-xs text-muted text-halo short:sr-only">
          {cta.note}
        </p>
      </div>
    </nav>
  );
}
