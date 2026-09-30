import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryLabel, getProject, nextProject } from '@/content/model';
import { getContent } from '@/server/storage';
import { CaseStudy } from '@/components/project/CaseStudy';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getContent();
  const p = getProject(c, slug);
  return {
    title: p ? `${p.title} — ${c.site.person.name}` : c.site.person.name,
    description: p?.summary,
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // read fresh on every request: edits saved in /admin show up immediately
  const c = await getContent();
  const project = getProject(c, slug);
  if (!project) notFound();
  const next = nextProject(c, project.slug);
  return (
    <CaseStudy
      key={`${project.id}:${c.updatedAt}`}
      project={project}
      category={categoryLabel(c, project.category)}
      next={next && { project: next, category: categoryLabel(c, next.category) }}
    />
  );
}
