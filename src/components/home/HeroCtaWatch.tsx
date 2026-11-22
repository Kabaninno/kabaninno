'use client';

import { useEffect } from 'react';

/** Attribute on the home call-to-action that the HUD button yields to (D148). */
const HERO_CTA_ATTRIBUTE = 'data-hero-cta';
/** Attribute on `<html>` while that call-to-action is on screen (read by globals.css). */
const HERO_CTA_VISIBLE_ATTRIBUTE = 'data-hero-cta-visible';

/**
 * Renders nothing. While the home call-to-action (`[data-hero-cta]`) is on
 * screen it sets `data-hero-cta-visible` on `<html>`, and the HUD button
 * (`.hud-cta`) hides itself: one "Find your solution" button at a time. It is
 * mounted with the home UI only, so every other page keeps the HUD button
 * always visible; the cleanup removes the attribute on leaving.
 */
export function HeroCtaWatch() {
  useEffect(() => {
    const target = document.querySelector(`[${HERO_CTA_ATTRIBUTE}]`);
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      if (entry.isIntersecting) root.setAttribute(HERO_CTA_VISIBLE_ATTRIBUTE, '');
      else root.removeAttribute(HERO_CTA_VISIBLE_ATTRIBUTE);
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
      root.removeAttribute(HERO_CTA_VISIBLE_ATTRIBUTE);
    };
  }, []);
  return null;
}
