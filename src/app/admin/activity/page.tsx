import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, fmtDateTime } from '@/lib/admin';

export const metadata: Metadata = { title: 'Activity' };

type Login = { user_id: string; username: string; full_name: string; email: string | null; last_sign_in_at: string };
type Action = {
  id: string; created_at: string; action: string; reason: string | null; admin_username: string | null;
  target_username: string | null; target_user_id: string | null; target_post_id: string | null;
};

const ACTION_TEXT: Record<string, string> = {
  suspend_user: 'suspended',
  deactivate_user: 'deactivated',
  reactivate_user: 'reactivated',
  delete_post: 'deleted a post by',
};

export default async function AdminActivityPage() {
  const { supabase } = await requireAdmin();
  const [loginsRes, logRes] = await Promise.all([
    supabase.rpc('admin_recent_logins', { p_limit: 30 }),
    supabase.rpc('admin_audit_log', { p_limit: 40 }),
  ]);
  const logins = (loginsRes.data ?? []) as Login[];
  const log = (logRes.data ?? []) as Action[];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-bold">Recent sign-ins</h1>
        <p className="text-sm text-muted">The latest sign-in for each user, newest first.</p>
        {logins.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No sign-ins recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {logins.map((l) => (
              <li key={l.user_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/admin/users/${l.user_id}`} className="block truncate font-semibold hover:underline">
                    {l.full_name} <span className="font-normal text-muted">@{l.username}</span>
                  </Link>
                  <p className="truncate text-sm text-muted">{l.email ?? 'no email'}</p>
                </div>
                <p className="shrink-0 text-right text-xs text-muted">{fmtDateTime(l.last_sign_in_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Admin activity log</h2>
        <p className="text-sm text-muted">Every suspension, reactivation and post removal, with the reason given.</p>
        {log.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing has been recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {log.map((a) => (
              <li key={a.id} className="py-3 text-sm">
                <p>
                  <span className="font-semibold">@{a.admin_username ?? 'unknown'}</span> {ACTION_TEXT[a.action] ?? a.action}{' '}
                  {a.target_user_id ? (
                    <Link href={`/admin/users/${a.target_user_id}`} className="font-semibold text-brand">
                      @{a.target_username ?? 'unknown'}
                    </Link>
                  ) : null}
                </p>
                {a.reason ? <p className="text-muted">Reason: {a.reason}</p> : null}
                <p className="text-xs text-muted">{fmtDateTime(a.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
