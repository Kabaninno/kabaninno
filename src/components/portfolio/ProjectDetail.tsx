import { getTranslations } from 'next-intl/server';
import { getCategory, type Project } from '~/content';
import { Breadcrumbs } from '@/components/panel/Breadcrumbs';
import { ContentPanel } from '@/components/panel/ContentPanel';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getCategoryText, getProjectText, getServiceText } from '@/lib/content-text';
import { paths } from '@/lib/routes';
import { accentStyle } from '@/lib/style';

/** Case study: facts, task / solution / result, stack and linked services. */
export async function ProjectDetail({ locale, project }: { locale: Locale; project: Project }) {
  const t = await getTranslations('portfolio');
  const tCommon = await getTranslations('common');
  const text = getProjectText(locale, project.slug);
  const colorOf = (categoryId: string) => getCategory(categoryId)?.dna.color ?? 'transparent';

  const facts = [
    [t('client'), text.client],
    [t('industry'), text.industry],
    [t('year'), String(project.year)],
  ] as const;

  const story = [
    ['task', t('task'), text.task],
    ['solution', t('solution'), text.solution],
    ['result', t('result'), text.result],
  ] as const;

  return (
    <ContentPanel labelledBy="project-title" style={accentStyle(colorOf(project.categories[0]!))}>
      <Breadcrumbs
        label={tCommon('breadcrumbs')}
        items={[
          { label: tCommon('backToUniverse'), href: paths.home() },
          { label: t('title'), href: paths.portfolio() },
          { label: text.title },
        ]}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 eyebrow">
        {project.categories.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              style={accentStyle(colorOf(id))}
              className="size-1.5 rounded-full bg-[var(--accent)]"
            />
            {getCategoryText(locale, id).name}
          </span>
        ))}
        {project.status === 'draft' ? (
          <span className="rounded-full border border-white/15 px-2 py-0.5 tracking-normal normal-case">
            {t('draftBadge')}
          </span>
        ) : null}
      </p>
      <h1
        id="project-title"
        className="mt-3 font-display text-[1.5rem] leading-tight font-medium text-ink md:text-[1.75rem]"
      >
        {text.title}
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink/90">{text.summary}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-white/[0.07] py-5 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1 eyebrow">{label}</dt>
            <dd className="text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-col gap-6">
        {story.map(([key, label, value]) => (
          <section key={key}>
            <h2 className="mb-2 eyebrow">{label}</h2>
            <p className="text-[0.9375rem] leading-relaxed text-muted">{value}</p>
          </section>
        ))}

        <section>
          <h2 className="mb-2 eyebrow">{t('stack')}</h2>
          <ul className="flex flex-wrap gap-1.5">
            {project.stack.map((item) => (
              <li
                key={item}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink/90"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        {project.services.length > 0 ? (
          <section>
            <h2 className="mb-2 eyebrow">{t('services')}</h2>
            <ul className="flex flex-col gap-1">
              {project.services.map((ref) => {
                const [categoryId, serviceSlug] = ref.split('/') as [string, string];
                return (
                  <li key={ref}>
                    <Link
                      href={paths.service(categoryId, serviceSlug)}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-ink transition-colors duration-150 hover:bg-white/[0.04] active:bg-white/[0.07]"
                    >
                      <span
                        aria-hidden="true"
                        style={accentStyle(colorOf(categoryId))}
                        className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                      />
                      <span>
                        {getServiceText(locale, categoryId, serviceSlug).title}
                        <span className="text-muted">
                          {' '}
                          · {getCategoryText(locale, categoryId).name}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      <Link
        href={paths.portfolio()}
        className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm text-muted transition-colors duration-150 hover:text-ink active:text-white"
      >
        <span aria-hidden="true">←</span>
        {t('allProjects')}
      </Link>
    </ContentPanel>
  );
}
