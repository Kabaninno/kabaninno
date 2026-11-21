import {
  contentTextsSchema,
  type CategoryText,
  type ContentTexts,
  type ProjectText,
  type ServiceText,
} from '~/content';
import { getMessagesFor } from '@/i18n/messages';
import type { Locale } from '@/i18n/routing';
import { bindShortWords } from './typography';

/**
 * Typed, validated access to content texts stored in the next-intl
 * dictionaries. Server-only: never import from client components.
 *
 * Texts are typeset once per locale: one-letter words get a non-breaking
 * space (see `bindShortWords`), so headings and cards never end a line with
 * "w", "i", "й"… wherever the texts are shown (panels, HUD, scene labels).
 */
const cache = new Map<Locale, ContentTexts>();

function typeset<T>(value: T, locale: Locale): T {
  if (typeof value === 'string') return bindShortWords(value, locale) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => typeset(item, locale)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, typeset(item, locale)]),
    ) as T;
  }
  return value;
}

export function getContentTexts(locale: Locale): ContentTexts {
  const cached = cache.get(locale);
  if (cached) return cached;
  const messages = getMessagesFor(locale);
  const parsed = typeset(
    contentTextsSchema.parse({
      categories: messages.categories,
      services: messages.services,
      projects: messages.projects,
    }),
    locale,
  );
  cache.set(locale, parsed);
  return parsed;
}

export function getCategoryText(locale: Locale, categoryId: string): CategoryText {
  const text = getContentTexts(locale).categories[categoryId];
  if (!text) throw new Error(`Missing text "categories.${categoryId}" for locale "${locale}"`);
  return text;
}

export function getServiceText(locale: Locale, categoryId: string, slug: string): ServiceText {
  const text = getContentTexts(locale).services[categoryId]?.[slug];
  if (!text) {
    throw new Error(`Missing text "services.${categoryId}.${slug}" for locale "${locale}"`);
  }
  return text;
}

export function getProjectText(locale: Locale, slug: string): ProjectText {
  const text = getContentTexts(locale).projects[slug];
  if (!text) throw new Error(`Missing text "projects.${slug}" for locale "${locale}"`);
  return text;
}
