import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { AdminPostItem, type AdminPost } from '@/components/admin/AdminPostItem';

export const metadata: Metadata = { title: 'Posts' };

const PER_PAGE = 15;

type Props = { searchParams: Promise<{ page?: string; done?: string; error?: string }> };

export default async function AdminPostsPage({ searchParams }: Props) {
  const { page: rawPage, done, error } = await searchParams;
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);

  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc('admin_recent_posts', { p_limit: PER_PAGE + 1, p_offset: (page - 1) * PER_PAGE, p_author: null });
  const rows = (data ?? []) as AdminPost[];
  const hasNext = rows.length > PER_PAGE;
  const posts = rows.slice(0, PER_PAGE);
  const imageUrl = (path: string) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Posts</h1>
      <p className="text-sm text-muted">Newest first. Removing a post needs a reason and is recorded in the activity log.</p>

      {done ? <p role="status" className="mt-4 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">Post deleted.</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}

      {posts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-semibold">No posts</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {posts.map((p) => (
            <AdminPostItem key={p.id} post={p} images={(p.image_paths ?? []).map(imageUrl)} returnTo="/admin/posts" />
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <div className="mt-4 flex justify-between text-sm font-semibold">
          {page > 1 ? <Link href={`/admin/posts?page=${page - 1}`} className="text-brand">Newer</Link> : <span />}
          {hasNext ? <Link href={`/admin/posts?page=${page + 1}`} className="text-brand">Older</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
