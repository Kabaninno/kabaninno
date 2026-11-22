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
  const tService = await getTranslations('service');

  const model = getConfiguratorModel();
  const labels = buildWizardLabels({
    locale,
    model,
    // The keys are built from model ids; next-intl's typed keys cannot see them.
    t: t as unknown as Translate,
    tLead: tLead as unknown as Translate,
    tService: tService as unknown as Translate,
    studio: siteConfig.studioName,
    category: (id) => ({
      name: getCategoryText(locale, id).name,
      color: getCategory(id)?.dna.color ?? '#E8ECF5',
    }),
    serviceTitle: (categoryId, slug) => getServiceText(locale, categoryId, slug).title,
    serviceBenefit: (categoryId, slug) => getServiceText(locale, categoryId, slug).benefit,
  });

  // The wizard renders the panel header itself: its lead shows on the first
  // step only (MJ-1). Phones opening the configurator directly get a tall sheet.
  return (
    <ContentPanel labelledBy="configurator-title" tallOnLoad>
      <ConfiguratorWizard
        model={model}
        labels={labels}
        locale={locale}
        telegramUsername={siteConfig.telegramUsername}
        whatsappNumber={siteConfig.whatsappNumber}
        header={{
          eyebrow: t('eyebrow'),
          title: bindShortWords(t('title'), locale),
          lead: bindShortWords(t('lead'), locale),
        }}
      />
    </ContentPanel>
  );
}
