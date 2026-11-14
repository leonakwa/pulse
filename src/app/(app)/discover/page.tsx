import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getPopularPosts } from '@/lib/posts';
import { Feed } from '@/components/Feed';
import { PersonRow, type Person } from '@/components/PersonRow';
import { SearchBox } from '@/components/SearchBox';

export const metadata: Metadata = { title: 'Discover' };

const PER_PAGE = 20;

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function DiscoverPage({ searchParams }: Props) {
  const { q: rawQ, page: rawPage } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 50);
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const searching = q.length >= 2;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  let results: Person[] = [];
  let hasNext = false;
  let suggestions: Person[] = [];
  let popular: Awaited<ReturnType<typeof getPopularPosts>> = [];

  if (searching) {
    const { data } = await supabase.rpc('search_profiles', { p_query: q, p_limit: PER_PAGE + 1, p_offset: (page - 1) * PER_PAGE });
    const rows = (data ?? []) as Person[];
    hasNext = rows.length > PER_PAGE;
    results = rows.slice(0, PER_PAGE);
  } else if (q.length === 0) {
    const [sugg, pop] = await Promise.all([supabase.rpc('suggested_accounts', { p_limit: 10 }), getPopularPosts(supabase, me.id, 10)]);
    suggestions = ((sugg.data ?? []) as Person[]).map((p) => ({ ...p, is_following: false }));
    popular = pop;
  }

  const base = `/discover?q=${encodeURIComponent(q)}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Discover</h1>
      <div className="mt-4">
        <SearchBox initial={q} />
      </div>

      {q.length === 1 ? <p className="mt-6 text-sm text-muted">Type at least 2 characters to search.</p> : null}

      {searching ? (
        <section className="mt-4" aria-live="polite">
          {results.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
              <p className="font-semibold">No one found for &ldquo;{q}&rdquo;</p>
              <p className="mt-1 text-sm text-muted">Check the spelling, or try part of a name or username.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {results.map((p) => (
                <PersonRow key={p.id} person={p} viewerId={me.id} />
              ))}
            </ul>
          )}
          {page > 1 || hasNext ? (
            <div className="mt-4 flex justify-between text-sm font-semibold">
              {page > 1 ? <Link href={`${base}&page=${page - 1}`} className="text-brand">Previous</Link> : <span />}
              {hasNext ? <Link href={`${base}&page=${page + 1}`} className="text-brand">Next</Link> : <span />}
            </div>
          ) : null}
        </section>
      ) : null}

      {q.length === 0 ? (
        <>
          <section className="mt-6">
            <h2 className="font-display text-lg font-bold">Suggested for you</h2>
            {suggestions.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
                <p className="font-semibold">No suggestions right now</p>
                <p className="mt-1 text-sm text-muted">When more people join PulseHive, you will see them here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {suggestions.map((p) => (
                  <PersonRow key={p.id} person={p} viewerId={me.id} />
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Popular posts</h2>
              <Link href="/feed?tab=discover" className="text-sm font-semibold text-brand">
                See all
              </Link>
            </div>
            <Feed
              scope="discover"
              currentUserId={me.id}
              initialPosts={popular}
              initialCursor={null}
              emptyTitle="No posts yet"
              emptyText="Popular posts from the last 30 days will show up here."
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
