import { requireAdmin, num } from '@/lib/admin';

type Overview = {
  total_users: number; new_users_24h: number; new_users_7d: number; active_users_7d: number; suspended_users: number;
  total_posts: number; posts_24h: number; total_comments: number; total_likes: number; total_follows: number;
  total_conversations: number; total_messages: number; total_xp: number;
};
type Day = { stat_day: string; new_users: number; new_posts: number; new_comments: number; new_likes: number };

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-2xl font-bold">{num(value)}</p>
      <p className="text-sm text-muted">{label}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();
  const [overviewRes, daysRes] = await Promise.all([supabase.rpc('admin_overview'), supabase.rpc('admin_daily_stats', { p_days: 14 })]);

  const o = ((overviewRes.data ?? []) as Overview[])[0];
  const days = (daysRes.data ?? []) as Day[];

  if (!o) {
    return <p className="text-danger">Could not load the dashboard numbers. Check that the admin SQL has been run.</p>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted">Platform numbers. Message contents are never shown here.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Registered users" value={o.total_users} sub={`+${num(o.new_users_24h)} today · +${num(o.new_users_7d)} this week`} />
          <Stat label="Active in last 7 days" value={o.active_users_7d} />
          <Stat label="Suspended or deactivated" value={o.suspended_users} />
          <Stat label="Posts" value={o.total_posts} sub={`+${num(o.posts_24h)} in 24 hours`} />
          <Stat label="Comments" value={o.total_comments} />
          <Stat label="Likes" value={o.total_likes} />
          <Stat label="Follows" value={o.total_follows} />
          <Stat label="Conversations" value={o.total_conversations} sub={`${num(o.total_messages)} messages`} />
          <Stat label="Total XP earned" value={o.total_xp} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Last 14 days (UTC)</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">New users</th>
                <th className="px-3 py-2 text-right font-medium">Posts</th>
                <th className="px-3 py-2 text-right font-medium">Comments</th>
                <th className="px-3 py-2 text-right font-medium">Likes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {days.map((d) => (
                <tr key={d.stat_day}>
                  <td className="px-3 py-2">{new Date(`${d.stat_day}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</td>
                  <td className="px-3 py-2 text-right">{num(d.new_users)}</td>
                  <td className="px-3 py-2 text-right">{num(d.new_posts)}</td>
                  <td className="px-3 py-2 text-right">{num(d.new_comments)}</td>
                  <td className="px-3 py-2 text-right">{num(d.new_likes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
