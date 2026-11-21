import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPanel } from '@/components/panel/ContentPanel';
import { isLocale } from '@/i18n/routing';
import { CONFIGURATOR_STEPS } from '@/lib/configurator-steps';
import { buildPageMetadata } from '@/lib/metadata';
import { paths } from '@/lib/routes';
import { formatIndex } from '@/lib/style';
import { bindShortWords } from '@/lib/typography';

interface ConfiguratorPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ConfiguratorPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return buildPageMetadata({
    locale,
    path: paths.configurator(),
    title: t('configuratorTitle'),
    description: t('configuratorDescription'),
  });
}

export default async function ConfiguratorPage({ params }: ConfiguratorPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('configurator');

  return (
    <ContentPanel labelledBy="configurator-title">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1
        id="configurator-title"
        className="mt-3 font-display text-[1.75rem] leading-tight font-medium text-ink md:text-[2rem]"
      >
        {bindShortWords(t('title'), locale)}
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
        {bindShortWords(t('lead'), locale)}
      </p>

      <h2 className="mt-8 mb-3 eyebrow">{t('stepsHeading')}</h2>
      <ol className="flex flex-col">
        {CONFIGURATOR_STEPS.map((step, index) => (
          <li
            key={step}
            className="flex min-h-12 items-center gap-4 border-b border-white/[0.06] text-[0.9375rem] text-ink/90 last:border-b-0"
          >
            <span aria-hidden="true" className="mono-index text-faint">
              {formatIndex(index + 1)}
            </span>
            {t(`steps.${step}`)}
          </li>
        ))}
      </ol>

      <p className="corner-brackets mt-6 bg-white/[0.025] px-4 py-3 text-sm text-muted">
        {bindShortWords(t('comingSoon'), locale)}
      </p>
    </ContentPanel>
  );
}
