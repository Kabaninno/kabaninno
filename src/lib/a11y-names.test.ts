import { describe, expect, it } from 'vitest';
import { editButtonName, requestLinkName } from './a11y-names';

describe('accessible names', () => {
  it('starts with the visible label and has no space before the punctuation', () => {
    expect(requestLinkName('Konfigurator', '1 usługa w zapytaniu')).toBe(
      'Konfigurator, 1 usługa w zapytaniu',
    );
    expect(editButtonName('Zmień', 'Budżet')).toBe('Zmień: Budżet');
    expect(editButtonName(' Змінити ', ' Бюджет ')).toBe('Змінити: Бюджет');
  });
});
