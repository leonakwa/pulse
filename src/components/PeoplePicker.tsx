'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';

export type PickPerson = { id: string; username: string; full_name: string; avatar_url: string | null };
type FollowRow = { person: PickPerson | PickPerson[] | null };

type Props = {
  currentUserId: string;
  excludeIds?: string[];
  selected: PickPerson[];
  onChange: (people: PickPerson[]) => void;
  max: number;
};

// Pick people: starts with the people you follow, or search by name or username.
export function PeoplePicker({ currentUserId, excludeIds = [], selected, onChange, max }: Props) {
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<PickPerson[]>([]);
  const [results, setResults] = useState<PickPerson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await createClient()
        .from('follows')
        .select('person:profiles!following_id(id, username, full_name, avatar_url)')
        .eq('follower_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      const people = ((data ?? []) as unknown as FollowRow[])
        .map((r) => (Array.isArray(r.person) ? r.person[0] : r.person))
        .filter((p): p is PickPerson => Boolean(p));
      setFollowing(people);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await createClient().rpc('search_profiles', { p_query: q, p_limit: 15, p_offset: 0 });
      setResults((data ?? []) as PickPerson[]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = query.trim().length >= 2;
  const list = (searching ? results : following).filter((p) => p.id !== currentUserId && !excludeIds.includes(p.id));
  const isSelected = (id: string) => selected.some((s) => s.id === id);

  function toggle(p: PickPerson) {
    if (isSelected(p.id)) onChange(selected.filter((s) => s.id !== p.id));
    else if (selected.length < max) onChange([...selected, p]);
  }

  return (
    <div>
      {selected.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Selected people">
          {selected.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-brand/15 py-1 pl-3 pr-1.5 text-sm font-semibold text-brand">
              {p.full_name}
              <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.full_name}`} className="rounded-full px-1.5 text-base leading-none hover:bg-brand/20">
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label htmlFor="picker-search" className="sr-only">
        Search people
      </label>
      <input id="picker-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people by name or username" autoComplete="off" className="input" />

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{searching ? 'Results' : 'People you follow'}</p>
      {loading ? <p className="py-3 text-sm text-muted">Searching...</p> : null}
      {!loading && list.length === 0 ? (
        <p className="py-3 text-sm text-muted">{searching ? 'No one found.' : 'You are not following anyone yet. Search for people above.'}</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((p) => {
            const on = isSelected(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  disabled={!on && selected.length >= max}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-50"
                >
                  <Avatar name={p.full_name} url={p.avatar_url} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.full_name}</span>
                    <span className="block truncate text-sm text-muted">@{p.username}</span>
                  </span>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${on ? 'border-brand bg-brand text-brand-fg' : 'border-line'}`}>
                    {on ? '✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
