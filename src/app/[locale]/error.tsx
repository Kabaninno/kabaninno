'use client';

import { useLocale, useTranslations } from 'next-intl';
import { PanelShell } from '@/components/panel/PanelShell';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { Link, usePathname } from '@/i18n/navigation';
import { paths } from '@/lib/routes';
import { withTrailingSlash } from '@/lib/style';
import { bindShortWords } from '@/lib/typography';

interface LocaleErrorProps {
  error: unknown;
  /** Re-fetches and re-renders the segment (Next.js 16). */
  retry: () => void;
}

/**
 * Localized error boundary for every page under `[locale]`. It renders inside
 * the locale layout, so the HUD and the 3D scene stay in place and only the
 * content area is replaced by a panel with "try again" and "back to the
 * universe". (Errors in the locale layout itself reach `global-error.tsx`.)
 * React already reports the caught error to the console.
 *
 * The panel is the bare `PanelShell` (no entrance animation, observers or
 * listeners): if the failure came from `ContentPanel`'s own effects, reusing
 * it here would make the fallback throw again and again (QA M1-2 N4).
 *
 * "Back to the universe" is a link elsewhere (a pathname change resets the
 * boundary). On the home page itself a link to the same URL would do nothing,
 * so there the action re-renders the universe instead (QA M1-3 C3-1).
 */
export default function LocaleError({ retry }: LocaleErrorProps) {
  const t = useTranslations('error');
  const locale = useLocale();
  const onHome = withTrailingSlash(usePathname()) === paths.home();
  const homeClass = `${secondaryButton} min-h-12 px-6 text-sm whitespace-nowrap`;

  return (
    <PanelShell labelledBy="error-title">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1
        id="error-title"
        className="mt-3 font-display text-title leading-tight font-medium text-ink md:text-title-lg"
      >
        {bindShortWords(t('title'), locale)}
      </h1>
      <p className="mt-3 text-body leading-relaxed text-muted">
        {bindShortWords(t('body'), locale)}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className={`${primaryButton} min-h-12 px-6 text-sm whitespace-nowrap`}
        >
          {t('retry')}
        </button>
        {onHome ? (
          <button type="button" onClick={() => retry()} className={homeClass}>
            <span aria-hidden="true">←</span>
            {t('home')}
          </button>
        ) : (
          <Link href={paths.home()} className={homeClass}>
            <span aria-hidden="true">←</span>
            {t('home')}
          </Link>
        )}
      </div>
    </PanelShell>
  );
}
