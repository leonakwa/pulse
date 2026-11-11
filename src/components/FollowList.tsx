import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';

const PER_PAGE = 30;

type Person = { id: string; username: string; full_name: string; bio: string | null; avatar_url: string | null };
type Row = { person: Person | Person[] | null };

export async function FollowList({ username, kind, page }: { username: string; kind: 'followers' | 'following'; page: number }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (!profile) notFound();

  // followers: people who follow this profile. following: people this profile follows.
  const filterColumn = kind === 'followers' ? 'following_id' : 'follower_id';
  const personColumn = kind === 'followers' ? 'follower_id' : 'following_id';
  const from = (page - 1) * PER_PAGE;

  const { data, count } = await supabase
    .from('follows')
    .select(`created_at, person:profiles!${personColumn}(id, username, full_name, bio, avatar_url)`, { count: 'exact' })
    .eq(filterColumn, profile.id)
    .order('created_at', { ascending: false })
    .range(from, from + PER_PAGE - 1);

  const people = ((data ?? []) as unknown as Row[])
    .map((r) => (Array.isArray(r.person) ? r.person[0] : r.person))
    .filter((p): p is Person => Boolean(p));

  let followingIds = new Set<string>();
  if (user && people.length > 0) {
    const { data: mine } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', people.map((p) => p.id));
    followingIds = new Set(((mine ?? []) as { following_id: string }[]).map((r) => r.following_id));
  }

  const total = count ?? 0;
  const hasNext = from + PER_PAGE < total;
  const base = `/u/${profile.username}/${kind}`;

  return (
    <section>
      <Link href={`/u/${profile.username}`} className="text-sm font-medium text-muted hover:text-fg">
        ← {profile.full_name}
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">{kind === 'followers' ? 'Followers' : 'Following'}</h1>
      <p className="text-sm text-muted">{total} {total === 1 ? 'person' : 'people'}</p>

      {people.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-semibold">{kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <Link href={`/u/${p.username}`} aria-label={`${p.full_name}'s profile`}>
                <Avatar name={p.full_name} url={p.avatar_url} size={48} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${p.username}`} className="block truncate font-semibold hover:underline">
                  {p.full_name}
                </Link>
                <p className="truncate text-sm text-muted">@{p.username}</p>
                {p.bio ? <p className="mt-0.5 line-clamp-1 text-sm">{p.bio}</p> : null}
              </div>
              {user && user.id !== p.id ? <FollowButton targetId={p.id} initialFollowing={followingIds.has(p.id)} /> : null}
            </li>
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <div className="mt-4 flex justify-between text-sm font-semibold">
          {page > 1 ? <Link href={`${base}?page=${page - 1}`} className="text-brand">Previous</Link> : <span />}
          {hasNext ? <Link href={`${base}?page=${page + 1}`} className="text-brand">Next</Link> : <span />}
        </div>
      ) : null}
    </section>
  );
}
