import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/Avatar';
import { LevelBadge } from '@/components/LevelBadge';

export const metadata: Metadata = { title: 'Leaderboard' };

const PER_PAGE = 25;

type Row = { place: number; user_id: string; username: string; full_name: string; avatar_url: string | null; level: number; level_name: string | null; xp: number };
type Props = { searchParams: Promise<{ period?: string; page?: string }> };

export default async function LeaderboardPage({ searchParams }: Props) {
  const { period: rawPeriod, page: rawPage } = await searchParams;
  const period = rawPeriod === 'all' ? 'all' : 'weekly';
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  const [boardRes, myRes] = await Promise.all([
    supabase.rpc('leaderboard_page', { p_period: period, p_limit: PER_PAGE + 1, p_offset: (page - 1) * PER_PAGE }),
    supabase.rpc('my_leaderboard_rank', { p_period: period }),
  ]);

  const rows = (boardRes.data ?? []) as Row[];
  const hasNext = rows.length > PER_PAGE;
  const board = rows.slice(0, PER_PAGE);
  const mine = ((myRes.data ?? []) as { place: number; xp: number }[])[0];

  const tab = (active: boolean) =>
    `flex-1 border-b-2 py-3 text-center text-sm font-semibold ${active ? 'border-brand text-fg' : 'border-transparent text-muted'}`;
  const base = `/leaderboard?period=${period}`;
  const when = period === 'weekly' ? 'this week' : 'all time';

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Leaderboard</h1>

      <nav aria-label="Leaderboard period" className="-mx-4 mt-3 flex border-b border-line">
        <Link href="/leaderboard?period=weekly" aria-current={period === 'weekly' ? 'page' : undefined} className={tab(period === 'weekly')}>
          This week
        </Link>
        <Link href="/leaderboard?period=all" aria-current={period === 'all' ? 'page' : undefined} className={tab(period === 'all')}>
          All time
        </Link>
      </nav>

      <div className="mt-4 rounded-2xl border border-line p-4">
        {mine ? (
          <p>
            You are <span className="font-bold text-brand">#{mine.place}</span> {when} with <span className="font-bold">{Number(mine.xp).toLocaleString('en')} XP</span>.
          </p>
        ) : (
          <p className="text-muted">You are not ranked {when} yet. Earn some XP to join the board.</p>
        )}
        <Link href="/xp" className="mt-1 inline-block text-sm font-semibold text-brand">
          See your progress →
        </Link>
      </div>

      {board.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-semibold">No one has earned XP {when} yet</p>
          <p className="mt-1 text-sm text-muted">Post, comment and follow people to get on the board.</p>
        </div>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {board.map((r) => (
            <li key={r.user_id} className={`flex items-center gap-3 px-2 py-3 ${r.user_id === me.id ? 'rounded-xl bg-brand/10' : ''}`}>
              <span className={`w-8 shrink-0 text-center font-display text-lg font-bold ${r.place <= 3 ? 'text-brand' : 'text-muted'}`}>{r.place}</span>
              <Link href={`/u/${r.username}`} aria-label={`${r.full_name}'s profile`}>
                <Avatar name={r.full_name} url={r.avatar_url} size={44} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${r.username}`} className="block truncate font-semibold hover:underline">
                  {r.full_name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2">
                  <LevelBadge level={r.level} name={r.level_name} />
                </div>
              </div>
              <span className="shrink-0 text-right font-bold">
                {Number(r.xp).toLocaleString('en')}
                <span className="block text-xs font-normal text-muted">XP</span>
              </span>
            </li>
          ))}
        </ol>
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
