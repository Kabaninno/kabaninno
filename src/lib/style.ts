import type { CSSProperties } from 'react';

/** Inline style that sets the `--accent` custom property (focus rings, dots, highlights). */
export function accentStyle(color: string): CSSProperties {
  return { '--accent': color } as CSSProperties;
}

/** Two-digit index used by mono labels: 1 → "01". */
export function formatIndex(value: number): string {
  return String(value).padStart(2, '0');
}

/** Normalizes a pathname to end with "/" so route comparisons ignore trailing slashes. */
export function withTrailingSlash(pathname: string): string {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}
