'use client';

import { useLocale, useTranslations } from 'next-intl';
import { PanelShell } from '@/components/panel/PanelShell';
import { primaryButton, secondaryButton } from '@/components/ui/styles';
import { Link } from '@/i18n/navigation';
import { paths } from '@/lib/routes';
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
 */
export default function LocaleError({ retry }: LocaleErrorProps) {
  const t = useTranslations('error');
  const locale = useLocale();

  return (
    <PanelShell labelledBy="error-title">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1
        id="error-title"
        className="mt-3 font-display text-[1.625rem] leading-tight font-medium text-ink md:text-[1.875rem]"
      >
        {bindShortWords(t('title'), locale)}
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
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
        <Link
          href={paths.home()}
          className={`${secondaryButton} min-h-12 px-6 text-sm whitespace-nowrap`}
        >
          <span aria-hidden="true">←</span>
          {t('home')}
        </Link>
      </div>
    </PanelShell>
  );
}
