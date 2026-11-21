import { describe, expect, it } from 'vitest';
import { getMessagesFor, pickMessages } from './messages';
import { locales } from './routing';

describe('pickMessages', () => {
  it.each(locales)('returns only the requested namespaces (%s)', (locale) => {
    const messages = getMessagesFor(locale);
    const picked = pickMessages(messages, ['hud', 'error']);
    expect(Object.keys(picked).sort()).toEqual(['error', 'hud']);
    // Same objects, not copies: nothing else is serialized to the client.
    expect(picked.hud).toBe(messages.hud);
    expect(picked.error).toBe(messages.error);
  });

  it('keeps content texts out of the client subset', () => {
    const picked = pickMessages(getMessagesFor('pl'), ['hud']);
    expect(picked).not.toHaveProperty('services');
    expect(picked).not.toHaveProperty('categories');
    expect(picked).not.toHaveProperty('home');
  });

  it('returns an empty object for an empty selection', () => {
    expect(pickMessages(getMessagesFor('en'), [])).toEqual({});
  });
});

describe('getMessagesFor', () => {
  it('merges UI strings and content texts for each locale', () => {
    for (const locale of locales) {
      const messages = getMessagesFor(locale);
      expect(messages).toHaveProperty('hud');
      expect(messages).toHaveProperty('categories');
    }
  });
});
