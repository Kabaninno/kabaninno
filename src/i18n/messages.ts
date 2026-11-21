import enContent from '~/messages/en/content.json';
import enUi from '~/messages/en/ui.json';
import plContent from '~/messages/pl/content.json';
import plUi from '~/messages/pl/ui.json';
import ukContent from '~/messages/uk/content.json';
import ukUi from '~/messages/uk/ui.json';
import type { Locale } from './routing';

/**
 * Server-side dictionaries. UI strings (`ui.json`) and content texts
 * (`content.json`) are merged into one next-intl message tree.
 *
 * Do not import this module from client components: it would ship every
 * dictionary to the browser. Client components receive a picked subset via
 * `NextIntlClientProvider` or plain props.
 */
const messagesByLocale = {
  pl: { ...plUi, ...plContent },
  en: { ...enUi, ...enContent },
  uk: { ...ukUi, ...ukContent },
} satisfies Record<Locale, unknown>;

export type AppMessages = (typeof messagesByLocale)['pl'];

export function getMessagesFor(locale: Locale): AppMessages {
  return messagesByLocale[locale];
}

/** Returns a subset of top-level namespaces (for client providers). */
export function pickMessages<K extends keyof AppMessages>(
  messages: AppMessages,
  keys: readonly K[],
): Pick<AppMessages, K> {
  const picked = {} as Pick<AppMessages, K>;
  for (const key of keys) picked[key] = messages[key];
  return picked;
}
