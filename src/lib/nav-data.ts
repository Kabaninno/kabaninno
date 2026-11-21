import { getCategories } from '~/content';
import type { Locale } from '@/i18n/routing';
import { getCategoryText } from './content-text';
import type { NavCategory } from './nav';

/** Server-only: category navigation items for a locale, in content order. */
export function buildNavCategories(locale: Locale): NavCategory[] {
  return getCategories().map((category, position) => ({
    id: category.id,
    name: getCategoryText(locale, category.id).name,
    color: category.dna.color,
    index: position + 1,
  }));
}
