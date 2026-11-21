import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCategory } from '~/content';
import { siteConfig } from '~/site.config';
import { ConfiguratorWizard } from '@/components/configurator/ConfiguratorWizard';
import { ContentPanel } from '@/components/panel/ContentPanel';
import { isLocale } from '@/i18n/routing';
import { buildWizardLabels, type Translate } from '@/lib/configurator/labels';
import { getConfiguratorModel } from '@/lib/configurator/model';
import { getCategoryText, getServiceText } from '@/lib/content-text';
import { buildPageMetadata } from '@/lib/metadata';
import { paths } from '@/lib/routes';
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

/**
 * The request configurator. The option model and every label are resolved
 * here, on the server, and handed to the client wizard as plain props: no
 * content layer, dictionaries or ICU formatting in the browser (D05, D09).
 */
export default async function ConfiguratorPage({ params }: ConfiguratorPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('configurator');
  const tLead = await getTranslations('lead');

  const model = getConfiguratorModel();
  const labels = buildWizardLabels({
    locale,
    model,
    // The keys are built from model ids; next-intl's typed keys cannot see them.
    t: t as unknown as Translate,
    tLead: tLead as unknown as Translate,
    studio: siteConfig.studioName,
    category: (id) => ({
      name: getCategoryText(locale, id).name,
      color: getCategory(id)?.dna.color ?? '#E8ECF5',
    }),
    serviceTitle: (categoryId, slug) => getServiceText(locale, categoryId, slug).title,
  });

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
      <ConfiguratorWizard
        model={model}
        labels={labels}
        locale={locale}
        telegramUsername={siteConfig.telegramUsername}
      />
    </ContentPanel>
  );
}
