/**
 * Accessible names that extend a visible label. Chrome inserts a space
 * before a visually hidden (`sr-only`, absolutely positioned) child when it
 * computes a name from content, so "Zmień" + sr-only ": Budżet" was read as
 * "Zmień : Budżet" (F3). Components therefore render the visible label
 * `aria-hidden` and the whole name once, as one sr-only string built here.
 */

/** "Konfigurator" + "1 usługa w zapytaniu" → "Konfigurator, 1 usługa w zapytaniu". */
export function requestLinkName(label: string, countLabel: string): string {
  return `${label.trim()}, ${countLabel.trim()}`;
}

/** "Zmień" + "Budżet" → "Zmień: Budżet". */
export function editButtonName(action: string, field: string): string {
  return `${action.trim()}: ${field.trim()}`;
}
