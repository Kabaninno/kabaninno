import { getCategories } from '~/content';
import type { Locale } from '@/i18n/routing';
import { getCategoryText } from './content-text';
import type { NavCategory } from './nav';
import { serviceRef } from './request-draft';

/** Server-only: category navigation items for a locale, in content order. */
export function buildNavCategories(locale: Locale): NavCategory[] {
  return getCategories().map((category, position) => ({
    id: category.id,
    name: getCategoryText(locale, category.id).name,
    caption: getCategoryText(locale, category.id).caption,
    color: category.dna.color,
    index: position + 1,
  }));
}

/** Server-only: every service ref ("<category>/<slug>") of this build. */
export function allServiceRefs(): string[] {
  return getCategories().flatMap((category) =>
    category.services.map((service) => serviceRef(category.id, service.slug)),
  );
}
