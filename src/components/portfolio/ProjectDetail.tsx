import { getTranslations } from 'next-intl/server';
import { getCategory, getProjects, type Project } from '~/content';
import { HighlightLink } from '@/components/nav/HighlightLink';
import { Breadcrumbs } from '@/components/panel/Breadcrumbs';
import { ContentPanel } from '@/components/panel/ContentPanel';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getCategoryText, getProjectText, getServiceText } from '@/lib/content-text';
import { projectSiblings } from '@/lib/portfolio';
import { paths } from '@/lib/routes';
import { accentStyle } from '@/lib/style';
import { sceneNodeId } from '@/scene/node-ids';
import { ProjectDemo } from './demo/ProjectDemo';
import { ProjectGallery } from './ProjectGallery';

/**
 * Case study: facts, task / solution / result, the interactive demo, the
 * gallery, stack and linked services, then the previous / next case.
 * - «← Portfolio» is the panel's explicit back button (first breadcrumb);
 *   Esc leads there too (D42).
 * - Previous / next wrap around the visible cases and replace the history
 *   entry, like ←/→ and a swipe on the panel (siblings, D16), so Back returns
 *   to the portfolio list.
 */
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

  const neighbours = projectSiblings(
    getProjects().map((item) => item.slug),
    project.slug,
  );
  const siblings = neighbours
    ? { previous: paths.project(neighbours.previous), next: paths.project(neighbours.next) }
    : undefined;

  return (
    <ContentPanel
      labelledBy="project-title"
      style={accentStyle(colorOf(project.categories[0]!))}
      siblings={siblings}
    >
      <Breadcrumbs
        label={tCommon('breadcrumbs')}
        items={[{ label: t('title'), href: paths.portfolio() }, { label: text.title }]}
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

        {project.demo ? (
          <ProjectDemo demo={project.demo} title={text.title} locale={locale} />
        ) : null}

        <ProjectGallery gallery={project.gallery} title={text.title} />

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

      {neighbours ? (
        <nav aria-label={t('siblingsNav')} className="mt-8 border-t border-white/[0.07] pt-6">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['prev', neighbours.previous, t('previous')],
                ['next', neighbours.next, t('next')],
              ] as const
            ).map(([rel, slug, label]) => (
              <HighlightLink
                key={rel}
                href={paths.project(slug)}
                highlightId={sceneNodeId.project(slug)}
                replace
                rel={rel}
                className={`flex min-h-14 flex-col justify-start rounded-xl border border-white/[0.07] px-3 py-2 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline-offset-[-1px] active:bg-white/[0.07] ${rel === 'next' ? 'items-end text-right' : ''}`}
              >
                <span className="text-xs text-muted">
                  {rel === 'prev' ? <span aria-hidden="true">← </span> : null}
                  {label}
                  {rel === 'next' ? <span aria-hidden="true"> →</span> : null}
                </span>
                <span className="line-clamp-2 max-w-full text-sm leading-snug text-ink">
                  {getProjectText(locale, slug).title}
                </span>
              </HighlightLink>
            ))}
          </div>
        </nav>
      ) : null}
    </ContentPanel>
  );
}
