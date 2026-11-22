/**
 * Shared class lists for interactive elements. Every variant has hover,
 * focus-visible (global outline) and active states.
 */

/**
 * Solid pill CTA ("Build your request"). Hover: pure white, a thin light ring
 * and a brand glow; pair with `ctaArrow` for the arrow nudge. Active: presses
 * in slightly.
 */
export const primaryButton =
  'group inline-flex items-center justify-center gap-2 rounded-full bg-ink font-medium text-void ' +
  'transition-[background-color,box-shadow,scale] duration-200 ease-calm ' +
  'hover:bg-white hover:shadow-[0_0_0_1px_rgb(255_255_255/0.5),0_0_28px_color-mix(in_srgb,var(--color-brand)_32%,transparent)] ' +
  'focus-visible:shadow-[0_0_0_1px_rgb(255_255_255/0.5),0_0_28px_color-mix(in_srgb,var(--color-brand)_32%,transparent)] ' +
  'active:scale-[0.98] active:bg-white/85';

/** Arrow inside a primary button: nudges right while the button is hovered. */
export const ctaArrow =
  'inline-block transition-transform duration-200 ease-calm group-hover:translate-x-[3px]';

/** Outlined pill for secondary actions. */
export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/15 text-ink ' +
  'transition-colors duration-200 ease-calm ' +
  'hover:border-white/35 hover:bg-white/[0.06] active:bg-white/10';

/** Quiet text link inside the HUD (44 px tall on touch screens, M3-03). */
export const hudLink =
  'relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-body-s text-muted pointer-coarse:h-11 ' +
  'transition-colors duration-150 ease-calm ' +
  'hover:bg-white/[0.06] hover:text-ink active:bg-white/10 ' +
  'aria-[current]:text-ink aria-expanded:bg-white/[0.06] aria-expanded:text-ink';

/** Inline text link inside content panels. */
export const textLink =
  'underline decoration-white/25 underline-offset-4 transition-colors duration-150 ' +
  'hover:decoration-[var(--accent,var(--color-ink))] hover:text-ink active:text-white';
