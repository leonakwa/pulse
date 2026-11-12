import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MessageRow } from '@/components/MessageRow';
import type { Person } from '@/components/PersonRow';
import { SearchBox } from '@/components/SearchBox';

export const metadata: Metadata = { title: 'New message' };

type Props = { searchParams: Promise<{ q?: string }> };
type FollowRow = { person: Person | Person[] | null };

export default async function NewMessagePage({ searchParams }: Props) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 50);
  const searching = q.length >= 2;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  let people: Person[] = [];
  if (searching) {
    const { data } = await supabase.rpc('search_profiles', { p_query: q, p_limit: 20, p_offset: 0 });
    people = ((data ?? []) as Person[]).filter((p) => p.id !== me.id);
  } else if (q.length === 0) {
    const { data } = await supabase
      .from('follows')
      .select('person:profiles!following_id(id, username, full_name, bio, avatar_url)')
      .eq('follower_id', me.id)
      .order('created_at', { ascending: false })
      .limit(20);
    people = ((data ?? []) as unknown as FollowRow[])
      .map((r) => (Array.isArray(r.person) ? r.person[0] : r.person))
      .filter((p): p is Person => Boolean(p));
  }

  return (
    <div>
      <Link href="/messages" className="text-sm font-medium text-muted hover:text-fg">
        ← Messages
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">New message</h1>
      <div className="mt-4">
        <SearchBox initial={q} basePath="/messages/new" label="Search for someone to message" />
      </div>

      {q.length === 1 ? <p className="mt-6 text-sm text-muted">Type at least 2 characters to search.</p> : null}

      {q.length !== 1 ? (
        <section className="mt-4" aria-live="polite">
          {!searching ? <h2 className="text-sm font-semibold text-muted">People you follow</h2> : null}
          {people.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
              <p className="font-semibold">{searching ? `No one found for “${q}”` : 'Search for someone to message'}</p>
              <p className="mt-1 text-sm text-muted">
                {searching ? 'Check the spelling, or try part of a name.' : 'Type a name or username above.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {people.map((p) => (
                <MessageRow key={p.id} person={p} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
