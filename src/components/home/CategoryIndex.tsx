import { HighlightLink } from '@/components/nav/HighlightLink';
import type { NavCategory } from '@/lib/nav';
import { paths } from '@/lib/routes';
import { sceneNodeId } from '@/scene/node-ids';
import { accentStyle, formatIndex } from '@/lib/style';

interface CategoryIndexProps {
  label: string;
  categories: readonly NavCategory[];
}

/**
 * Ordered index of the service systems ("01 Web …"). Real links, reachable
 * with Tab; hover/focus highlights the matching node in the scene. Marked as a
 * scene overlay, so the camera keeps the network out from under it.
 *
 * Phones: wrapping glass chips. md+: a right-aligned column of quiet links.
 * Short viewports (landscape phones): one compact row under the hero; below
 * md the decorative mono numbers are dropped so the five chips fit one row
 * (the targets keep their 44px height).
 */
export function CategoryIndex({ label, categories }: CategoryIndexProps) {
  return (
    <nav aria-label={label} data-scene-overlay="" className="pointer-events-auto">
      <ol className="flex flex-wrap gap-1.5 md:flex-col md:items-end md:gap-0.5 short:flex-row short:items-center short:gap-1">
        {categories.map((category) => (
          <li key={category.id} style={accentStyle(category.color)}>
            <HighlightLink
              href={paths.category(category.id)}
              highlightId={sceneNodeId.category(category.id)}
              className="group flex min-h-11 items-center gap-2.5 rounded-full glass px-3.5 text-sm text-ink transition-[background-color,border-color,color] duration-200 ease-calm hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-[rgb(10_14_28/0.8)] focus-visible:border-[var(--accent)] active:bg-[rgb(10_14_28/0.9)] md:border-transparent md:bg-transparent md:px-3 md:text-muted md:[backdrop-filter:none] md:hover:bg-[rgb(10_14_28/0.55)] md:hover:text-ink short:gap-2 short:px-2.5 short:text-[0.8125rem]"
            >
              <span
                aria-hidden="true"
                className="mono-index text-faint group-hover:text-[var(--accent)] short:max-md:hidden"
              >
                {formatIndex(category.index)}
              </span>
              <span>{category.name}</span>
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] transition-transform duration-200 group-hover:scale-150"
              />
            </HighlightLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}
