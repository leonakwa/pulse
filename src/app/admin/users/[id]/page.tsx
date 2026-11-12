import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, fmtDateTime, num } from '@/lib/admin';
import { setUserStatus } from '@/lib/admin-actions';
import { StatusPill } from '@/components/admin/StatusPill';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { AdminPostItem, type AdminPost } from '@/components/admin/AdminPostItem';

export const metadata: Metadata = { title: 'User' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UserDetail = {
  id: string; username: string; full_name: string; bio: string | null; location: string | null; email: string | null;
  status: string; level: number; xp_total: number; post_count: number; follower_count: number; following_count: number;
  created_at: string; last_sign_in_at: string | null; email_confirmed: boolean; is_admin: boolean;
};
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; error?: string }> };

export default async function AdminUserPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { done, error } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const { supabase, user: me } = await requireAdmin();
  const [userRes, postsRes] = await Promise.all([
    supabase.rpc('admin_get_user', { p_user: id }),
    supabase.rpc('admin_recent_posts', { p_limit: 10, p_offset: 0, p_author: id }),
  ]);
  const u = ((userRes.data ?? []) as UserDetail[])[0];
  if (!u) notFound();
  const posts = (postsRes.data ?? []) as AdminPost[];

  const imageUrl = (path: string) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
  const isSelf = u.id === me.id;
  const protectedAccount = isSelf || u.is_admin;

  const facts: [string, string][] = [
    ['Email', u.email ? `${u.email}${u.email_confirmed ? '' : ' (not confirmed)'}` : 'none'],
    ['Joined', fmtDateTime(u.created_at)],
    ['Last sign-in', fmtDateTime(u.last_sign_in_at)],
    ['Level', `${u.level} · ${num(u.xp_total)} XP`],
    ['Posts', num(u.post_count)],
    ['Followers / following', `${num(u.follower_count)} / ${num(u.following_count)}`],
    ['Location', u.location ?? '–'],
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm font-medium text-muted hover:text-fg">
          ← Users
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold">{u.full_name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted">@{u.username}</span>
          <StatusPill status={u.status} />
          {u.is_admin ? <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand">Admin</span> : null}
        </div>
        {u.bio ? <p className="mt-2 whitespace-pre-line text-sm">{u.bio}</p> : null}
        <Link href={`/u/${u.username}`} className="mt-2 inline-block text-sm font-semibold text-brand">
          View public profile →
        </Link>
      </div>

      {done ? <p role="status" className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{done === 'post' ? 'Post deleted.' : 'Account updated.'}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}

      <dl className="divide-y divide-line rounded-2xl border border-line">
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium break-all">{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="font-display text-lg font-bold">Manage account</h2>
        {protectedAccount ? (
          <p className="mt-2 text-sm text-muted">{isSelf ? 'You cannot change your own account.' : 'Admin accounts are protected.'}</p>
        ) : u.status === 'active' ? (
          <form action={setUserStatus} className="mt-3 space-y-3">
            <input type="hidden" name="userId" value={u.id} />
            <label htmlFor="reason" className="label">
              Reason (recorded in the activity log)
            </label>
            <textarea id="reason" name="reason" required minLength={3} maxLength={300} rows={2} className="input resize-none" />
            <div className="flex flex-wrap gap-2">
              <ConfirmButton name="status" value="suspended" message="Suspend this account? They will be signed out of Pulse and blocked until you reactivate them." className="rounded-full border border-danger/50 px-5 py-2 text-sm font-semibold text-danger hover:bg-danger/10">
                Suspend
              </ConfirmButton>
              <ConfirmButton name="status" value="deactivated" message="Deactivate this account? They will be blocked until you reactivate them." className="rounded-full border border-line px-5 py-2 text-sm font-semibold hover:border-danger hover:text-danger">
                Deactivate
              </ConfirmButton>
            </div>
          </form>
        ) : (
          <form action={setUserStatus} className="mt-3 space-y-3">
            <input type="hidden" name="userId" value={u.id} />
            <input type="hidden" name="status" value="active" />
            <label htmlFor="reason" className="label">
              Note (optional)
            </label>
            <textarea id="reason" name="reason" maxLength={300} rows={2} className="input resize-none" />
            <ConfirmButton message="Reactivate this account?" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-fg">
              Reactivate
            </ConfirmButton>
          </form>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Recent posts</h2>
        {posts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No posts.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {posts.map((p) => (
              <AdminPostItem key={p.id} post={p} images={(p.image_paths ?? []).map(imageUrl)} returnTo={`/admin/users/${u.id}`} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
