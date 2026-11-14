import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LevelBadge } from '@/components/LevelBadge';
import { timeAgo } from '@/lib/time';

export const metadata: Metadata = { title: 'Your progress' };

const HISTORY_PER_PAGE = 15;

type Level = { level: number; name: string; tagline: string; min_xp: number; min_posts: number; min_followers: number };
type Rule = { reason: string; amount: number; daily_cap: number; label: string; earn_text: string };
type Txn = { id: string; reason: string; amount: number; created_at: string };

const fmt = (n: number) => n.toLocaleString('en');

function Bar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target <= 0 ? 100 : Math.min(100, Math.floor((value / target) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted">
          {fmt(Math.min(value, target))} / {fmt(target)}
        </span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type Props = { searchParams: Promise<{ page?: string }> };

export default async function XpPage({ searchParams }: Props) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const from = (page - 1) * HISTORY_PER_PAGE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [profileRes, levelsRes, rulesRes, streakRes, postsRes, followersRes, todayRes, historyRes, rankRes] = await Promise.all([
    supabase.from('profiles').select('xp_total, level').eq('id', me.id).maybeSingle(),
    supabase.from('levels').select('level, name, tagline, min_xp, min_posts, min_followers').order('level'),
    supabase.from('xp_rules').select('reason, amount, daily_cap, label, earn_text').order('sort_order'),
    supabase.from('user_streaks').select('current_streak, longest_streak').eq('user_id', me.id).maybeSingle(),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', me.id).eq('is_share', false),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', me.id),
    supabase.from('xp_transactions').select('reason, amount').gte('created_at', dayStart.toISOString()),
    supabase
      .from('xp_transactions')
      .select('id, reason, amount, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + HISTORY_PER_PAGE - 1),
    supabase.rpc('my_leaderboard_rank', { p_period: 'all' }),
  ]);

  const xp = Number(profileRes.data?.xp_total ?? 0);
  const levelNo = Number(profileRes.data?.level ?? 1);
  const levels = (levelsRes.data ?? []) as Level[];
  const rules = (rulesRes.data ?? []) as Rule[];
  const current = levels.find((l) => l.level === levelNo);
  const next = levels.find((l) => l.level === levelNo + 1);
  const posts = postsRes.count ?? 0;
  const followers = followersRes.count ?? 0;
  const streak = streakRes.data as { current_streak: number; longest_streak: number } | null;
  const rank = ((rankRes.data ?? []) as { place: number }[])[0]?.place;

  const todayByReason = new Map<string, number>();
  for (const t of (todayRes.data ?? []) as { reason: string; amount: number }[]) {
    todayByReason.set(t.reason, (todayByReason.get(t.reason) ?? 0) + t.amount);
  }
  const labelOf = new Map(rules.map((r) => [r.reason, r.label]));
  const history = (historyRes.data ?? []) as Txn[];
  const hasNext = from + HISTORY_PER_PAGE < (historyRes.count ?? 0);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your level</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">
          Level {levelNo} <span className="text-brand">{current?.name}</span>
        </h1>
        {current ? <p className="mt-2 text-muted">{current.tagline}</p> : null}
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-line p-3">
            <dd className="text-xl font-bold">{fmt(xp)}</dd>
            <dt className="text-xs text-muted">XP</dt>
          </div>
          <div className="rounded-2xl border border-line p-3">
            <dd className="text-xl font-bold">{rank ? `#${rank}` : '–'}</dd>
            <dt className="text-xs text-muted">All-time rank</dt>
          </div>
          <div className="rounded-2xl border border-line p-3">
            <dd className="text-xl font-bold">{streak?.current_streak ?? 0}</dd>
            <dt className="text-xs text-muted">Day streak</dt>
          </div>
        </dl>
        <Link href="/leaderboard" className="mt-3 inline-block text-sm font-semibold text-brand">
          See the leaderboard →
        </Link>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">{next ? `Next: Level ${next.level} · ${next.name}` : 'You reached the top'}</h2>
        {next ? (
          <>
            <p className="mt-1 text-sm text-muted">{next.tagline} To level up you need all three below, not just XP.</p>
            <div className="mt-4 space-y-4">
              <Bar label="XP" value={xp} target={next.min_xp} />
              <Bar label="Posts" value={posts} target={next.min_posts} />
              <Bar label="Followers" value={followers} target={next.min_followers} />
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">You are a Legend: the pulse of PulseHive. More levels may be added later.</p>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">How to earn XP</h2>
        <ul className="mt-3 divide-y divide-line">
          {rules.map((r) => (
            <li key={r.reason} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[15px]">{r.earn_text}</p>
                <p className="text-xs text-muted">
                  Today: {todayByReason.get(r.reason) ?? 0} / {r.daily_cap} XP
                </p>
              </div>
              <span className="shrink-0 font-bold text-brand">+{r.amount}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Daily limits reset at midnight UTC. Likes and comments on your own posts, and repeat actions, do not earn XP.
          Likes, comments and follows from brand-new accounts (under 24 hours old) do not earn XP for others.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">The 10 levels</h2>
        <ol className="mt-3 space-y-2">
          {levels.map((l) => {
            const reached = l.level <= levelNo;
            return (
              <li key={l.level} className={`rounded-2xl border p-3 ${l.level === levelNo ? 'border-brand bg-brand/10' : 'border-line'} ${reached ? '' : 'opacity-70'}`}>
                <div className="flex items-center justify-between gap-2">
                  <LevelBadge level={l.level} name={l.name} />
                  {reached ? <span className="text-xs font-semibold text-success">{l.level === levelNo ? 'You are here' : 'Reached'}</span> : null}
                </div>
                <p className="mt-1.5 text-sm">{l.tagline}</p>
                <p className="mt-1 text-xs text-muted">
                  {fmt(l.min_xp)} XP · {fmt(l.min_posts)} posts · {fmt(l.min_followers)} followers
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">XP history</h2>
        {history.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="font-semibold">No XP yet</p>
            <p className="mt-1 text-sm text-muted">Post, comment or follow someone to earn your first XP.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px]">{labelOf.get(t.reason) ?? t.reason}</p>
                  <time dateTime={t.created_at} suppressHydrationWarning className="text-xs text-muted">
                    {timeAgo(t.created_at)}
                  </time>
                </div>
                <span className="shrink-0 font-bold text-brand">+{t.amount}</span>
              </li>
            ))}
          </ul>
        )}
        {page > 1 || hasNext ? (
          <div className="mt-4 flex justify-between text-sm font-semibold">
            {page > 1 ? <Link href={`/xp?page=${page - 1}`} className="text-brand">Newer</Link> : <span />}
            {hasNext ? <Link href={`/xp?page=${page + 1}`} className="text-brand">Older</Link> : <span />}
          </div>
        ) : null}
      </section>
    </div>
  );
}
