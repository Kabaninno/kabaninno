/**
 * Locale-less route builders. Pass the result to next-intl's `Link`/`router`,
 * which adds the locale prefix (and Next.js adds the base path). Paths end with
 * a slash to match `trailingSlash: true` and the canonical URLs.
 */
export const paths = {
  home: () => '/',
  category: (categoryId: string) => `/services/${categoryId}/`,
  service: (categoryId: string, serviceSlug: string) => `/services/${categoryId}/${serviceSlug}/`,
  portfolio: () => '/portfolio/',
  project: (projectSlug: string) => `/portfolio/${projectSlug}/`,
  configurator: () => '/configurator/',
} as const;
