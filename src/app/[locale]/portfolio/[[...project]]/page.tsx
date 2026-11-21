import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProject, getProjects, type Project } from '~/content';
import { siteConfig } from '~/site.config';
import { PortfolioIndex } from '@/components/portfolio/PortfolioIndex';
import { ProjectDetail } from '@/components/portfolio/ProjectDetail';
import { isLocale } from '@/i18n/routing';
import { getProjectText } from '@/lib/content-text';
import { buildPageMetadata } from '@/lib/metadata';
import { paths } from '@/lib/routes';

/*
 * `/portfolio/` and `/portfolio/<project>/` share one optional catch-all route.
 *
 * Why: with `output: 'export'`, Next.js 16 fails the build when a dynamic
 * route's `generateStaticParams()` returns an empty array. Production builds
 * have zero visible projects while every case is a draft (D12), so a separate
 * `portfolio/[project]` route would break the build. Here the params always
 * contain the index entry, plus one entry per visible project — no placeholder
 * pages and no draft pages are emitted.
 */

interface PortfolioRouteProps {
  params: Promise<{ locale: string; project?: string[] }>;
}

export const dynamicParams = false;

export function generateStaticParams(): { project: string[] }[] {
  return [{ project: [] }, ...getProjects().map((project) => ({ project: [project.slug] }))];
}

type PortfolioView = { kind: 'index' } | { kind: 'project'; project: Project } | null;

function resolveView(segments: readonly string[] | undefined): PortfolioView {
  if (!segments || segments.length === 0) return { kind: 'index' };
  if (segments.length !== 1) return null;
  const project = getProject(segments[0]!);
  return project ? { kind: 'project', project } : null;
}

export async function generateMetadata({ params }: PortfolioRouteProps): Promise<Metadata> {
  const { locale, project } = await params;
  const view = resolveView(project);
  if (!isLocale(locale) || !view) return {};

  if (view.kind === 'project') {
    const text = getProjectText(locale, view.project.slug);
    return buildPageMetadata({
      locale,
      path: paths.project(view.project.slug),
      title: text.title,
      description: text.summary,
    });
  }

  const t = await getTranslations({ locale, namespace: 'meta' });
  return buildPageMetadata({
    locale,
    path: paths.portfolio(),
    title: t('portfolioTitle'),
    description: t('portfolioDescription', { studio: siteConfig.studioName }),
  });
}

export default async function PortfolioRoute({ params }: PortfolioRouteProps) {
  const { locale, project } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const view = resolveView(project);
  if (!view) notFound();

  return view.kind === 'project' ? (
    <ProjectDetail locale={locale} project={view.project} />
  ) : (
    <PortfolioIndex locale={locale} projects={getProjects()} />
  );
}
