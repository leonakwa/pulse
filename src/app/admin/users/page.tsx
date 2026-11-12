import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, fmtDate } from '@/lib/admin';
import { StatusPill } from '@/components/admin/StatusPill';

export const metadata: Metadata = { title: 'Users' };

const PER_PAGE = 25;

type UserRow = {
  id: string; username: string; full_name: string; email: string | null; status: string; level: number; xp_total: number;
  post_count: number; follower_count: number; created_at: string; last_sign_in_at: string | null; email_confirmed: boolean; is_admin: boolean;
};
type Props = { searchParams: Promise<{ q?: string; status?: string; page?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q: rawQ, status: rawStatus, page: rawPage } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 60);
  const status = ['active', 'suspended', 'deactivated'].includes(rawStatus ?? '') ? (rawStatus as string) : 'all';
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);

  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc('admin_list_users', {
    p_query: q,
    p_status: status,
    p_limit: PER_PAGE + 1,
    p_offset: (page - 1) * PER_PAGE,
  });
  const rows = (data ?? []) as UserRow[];
  const hasNext = rows.length > PER_PAGE;
  const users = rows.slice(0, PER_PAGE);
  const base = `/admin/users?q=${encodeURIComponent(q)}&status=${status}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Users</h1>

      <form method="get" className="mt-4 flex gap-2">
        <label htmlFor="admin-q" className="sr-only">
          Search users
        </label>
        <input id="admin-q" name="q" defaultValue={q} placeholder="Name, username or email" className="input" />
        <label htmlFor="admin-status" className="sr-only">
          Status
        </label>
        <select id="admin-status" name="status" defaultValue={status} className="input !w-auto">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <button type="submit" className="shrink-0 rounded-full bg-brand px-5 text-sm font-semibold text-brand-fg">
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-semibold">No users found</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="block py-3 hover:bg-surface">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">
                    {u.full_name} <span className="font-normal text-muted">@{u.username}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {u.is_admin ? <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand">Admin</span> : null}
                    <StatusPill status={u.status} />
                  </div>
                </div>
                <p className="truncate text-sm text-muted">{u.email ?? 'no email'}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Joined {fmtDate(u.created_at)} · Last sign-in {u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : 'never'} · Lv {u.level} · {u.post_count} posts · {u.follower_count} followers
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <div className="mt-4 flex justify-between text-sm font-semibold">
          {page > 1 ? <Link href={`${base}&page=${page - 1}`} className="text-brand">Previous</Link> : <span />}
          {hasNext ? <Link href={`${base}&page=${page + 1}`} className="text-brand">Next</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
