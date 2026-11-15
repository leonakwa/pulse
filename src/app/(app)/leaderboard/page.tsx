import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LevelBadge } from '@/components/LevelBadge';

export const metadata: Metadata = { title: 'Your standing' };

type Props = { searchParams: Promise<{ period?: string }> };

// The standing is private: it shows only YOUR place, never anyone else's.
export default async function StandingPage({ searchParams }: Props) {
  const { period: rawPeriod } = await searchParams;
  const period = rawPeriod === 'all' ? 'all' : 'weekly';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  const [standingRes, profileRes] = await Promise.all([
    supabase.rpc('my_standing', { p_period: period }),
    supabase.from('profiles').select('xp_total, level').eq('id', me.id).maybeSingle(),
  ]);

  const mine = ((standingRes.data ?? []) as { place: number; xp: number; ranked: number }[])[0];
  const levelNo = Number(profileRes.data?.level ?? 1);
  const { data: levelRow } = await supabase.from('levels').select('name').eq('level', levelNo).maybeSingle();

  const tab = (active: boolean) =>
    `flex-1 border-b-2 py-3 text-center text-sm font-semibold ${active ? 'border-brand text-fg' : 'border-transparent text-muted'}`;
  const when = period === 'weekly' ? 'this week' : 'of all time';

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Your standing</h1>
      <p className="mt-1 text-sm text-muted">Only you can see this. Other members cannot see where you rank, and you cannot see theirs.</p>

      <nav aria-label="Standing period" className="-mx-4 mt-3 flex border-b border-line">
        <Link href="/leaderboard?period=weekly" aria-current={period === 'weekly' ? 'page' : undefined} className={tab(period === 'weekly')}>
          This week
        </Link>
        <Link href="/leaderboard?period=all" aria-current={period === 'all' ? 'page' : undefined} className={tab(period === 'all')}>
          All time
        </Link>
      </nav>

      <section className="mt-6 rounded-2xl border border-line p-6 text-center">
        {mine ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your place {when}</p>
            <p className="mt-1 font-display text-6xl font-extrabold text-brand">#{Number(mine.place).toLocaleString('en')}</p>
            <p className="mt-2 text-muted">out of {Number(mine.ranked).toLocaleString('en')} {Number(mine.ranked) === 1 ? 'member' : 'members'} with XP</p>
            <p className="mt-4 text-lg font-bold">{Number(mine.xp).toLocaleString('en')} XP</p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-bold">Not ranked yet</p>
            <p className="mt-2 text-muted">Earn some XP {when} to get a place. Post, comment, reply and connect with people.</p>
          </>
        )}
        <div className="mt-4 flex items-center justify-center gap-2">
          <LevelBadge level={levelNo} name={levelRow?.name} />
        </div>
      </section>

      <p className="mt-6 text-sm text-muted">
        Places are based on the XP you earned {period === 'weekly' ? 'in the last 7 days' : 'in total'}. People with the same XP share the same place.
      </p>
      <Link href="/xp" className="mt-3 inline-block text-sm font-semibold text-brand">
        See your level progress and how to earn XP →
      </Link>
    </div>
  );
}
