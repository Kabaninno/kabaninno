import type { ReactNode } from 'react';
import './globals.css';

/**
 * Pass-through root layout (next-intl pattern for a `[locale]` root). The
 * `<html>` element is rendered by `[locale]/layout.tsx`, and by the redirect
 * page (`page.tsx`) and `not-found.tsx`, which live outside any locale.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
