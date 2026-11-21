import { Link } from '@/i18n/navigation';

export interface BreadcrumbItem {
  label: string;
  /** Locale-less path; omit for the current page. */
  href?: string;
}

/**
 * Breadcrumb trail; the first item gets a "←" affordance (back to the
 * universe). The trail stays on one line: ancestors keep their width and the
 * current page (repeated by the h1 right below) truncates with an ellipsis,
 * so a wrapped line never starts with a bare "/".
 */
export function Breadcrumbs({ label, items }: { label: string; items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label={label} className="mb-5">
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem] text-muted">
        {items.map((item, index) => (
          <li
            key={`${index}-${item.label}`}
            className={`flex items-center gap-1 ${item.href ? 'shrink-0' : 'min-w-0'}`}
          >
            {index > 0 ? (
              <span aria-hidden="true" className="px-1 text-faint">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 whitespace-nowrap transition-colors duration-150 hover:text-ink active:text-white md:min-h-8"
              >
                {index === 0 ? <span aria-hidden="true">←</span> : null}
                {item.label}
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
