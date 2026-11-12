import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { Wordmark } from '@/components/Wordmark';
import { AdminNav } from '@/components/admin/AdminNav';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | Pulse Admin' }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wordmark className="!text-xl" />
            <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-bold text-danger">Admin</span>
          </div>
          <Link href="/feed" className="btn-ghost">
            Back to app
          </Link>
        </div>
        <AdminNav />
      </header>
      <main className="p-4 pb-16">{children}</main>
    </div>
  );
}
