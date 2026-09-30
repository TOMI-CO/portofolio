import type { Metadata } from 'next';
import { isAuthed } from '@/server/auth';
import { getContent } from '@/server/storage';
import { AdminApp } from '@/admin/AdminApp';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin — Portfolio',
  robots: { index: false, follow: false },
};

/** /admin — login screen, then the content editor. Everything saved here goes live immediately. */
export default async function AdminPage() {
  const authed = await isAuthed();
  return <AdminApp initial={authed ? await getContent() : null} />;
}
