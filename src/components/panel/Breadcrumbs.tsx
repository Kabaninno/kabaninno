import { Link } from '@/i18n/navigation';

export interface BreadcrumbItem {
  label: string;
  /** Locale-less path; omit for the current page. */
  href?: string;
}

/**
 * Breadcrumb trail. The first item is the explicit «← Universe» button of
 * system and planet panels (BRIEF scene 2: an outlined pill, not just a
 * crumb). The trail stays on one line, so a wrapped line never starts with
 * a bare "/": the pill keeps its width, other ancestors and the current page
 * (repeated by the h1 right below) truncate with an ellipsis. In the narrow
 * bottom sheet the current page is left to screen readers only, so a
 * collapsed sheet never shows a clipped "Strony fi…" crumb (visual mn6).
 */
export function Breadcrumbs({ label, items }: { label: string; items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label={label} className="mb-5">
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem] text-muted">
        {items.map((item, index) => (
          <li
            key={`${index}-${item.label}`}
            className={`flex items-center gap-1 ${
              index === 0 ? 'shrink-0' : item.href ? 'min-w-0' : 'sr-only min-w-0 side:not-sr-only'
            }`}
          >
            {index > 0 ? (
              <span aria-hidden="true" className="px-1 text-faint">
                /
              </span>
            ) : null}
            {item.href && index === 0 ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-3.5 whitespace-nowrap text-ink transition-colors duration-150 hover:border-white/35 hover:bg-white/[0.06] active:bg-white/10 md:min-h-9"
              >
                <span aria-hidden="true">←</span>
                {item.label}
              </Link>
            ) : item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 min-w-0 items-center rounded-full px-1 transition-colors duration-150 hover:text-ink active:text-white md:min-h-8"
              >
                <span className="truncate">{item.label}</span>
              </Link>
            ) : (
              <span aria-current="page" className="min-w-0 truncate px-1 text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
