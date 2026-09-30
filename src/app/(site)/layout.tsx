import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import { ContentProvider } from '@/content/ContentProvider';
import { getContent } from '@/server/storage';

// content is edited from /admin: always render with the latest saved version
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContent();
  return { title: site.seo.title || site.person.name, description: site.seo.description };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const content = await getContent();
  return (
    <ContentProvider content={content}>
      <AppShell>{children}</AppShell>
    </ContentProvider>
  );
}
