import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/Avatar';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, bio, location, avatar_url, cover_url, created_at')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (!profile) notFound();

  const [followers, following] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
  ]);

  const isOwn = user?.id === profile.id;
  const joined = new Date(profile.created_at).toLocaleDateString('en', { month: 'long', year: 'numeric' });

  return (
    <article>
      <div className="h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-brand/40 via-brand/10 to-surface sm:h-44">
        {profile.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="-mt-12 flex items-end justify-between px-3">
        <Avatar name={profile.full_name} url={profile.avatar_url} size={96} className="ring-4 ring-bg" />
        {isOwn ? (
          <Link href="/settings/profile" className="mb-1 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">
            Edit profile
          </Link>
        ) : null}
      </div>

      <div className="mt-3 px-1">
        <h1 className="font-display text-2xl font-bold leading-tight">{profile.full_name}</h1>
        <p className="text-muted">@{profile.username}</p>
        {profile.bio ? <p className="mt-3 whitespace-pre-line">{profile.bio}</p> : null}
        <p className="mt-3 text-sm text-muted">
          {profile.location ? `${profile.location} · ` : ''}Joined {joined}
        </p>

        <dl className="mt-4 flex gap-6">
          <div>
            <dt className="sr-only">Followers</dt>
            <dd>
              <span className="font-bold">{followers.count ?? 0}</span> <span className="text-muted">Followers</span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Following</dt>
            <dd>
              <span className="font-bold">{following.count ?? 0}</span> <span className="text-muted">Following</span>
            </dd>
          </div>
        </dl>
      </div>

      <section className="mt-8 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
        <p className="font-semibold">No posts yet</p>
        <p className="mt-1 text-sm text-muted">Posts will appear here once posting is added.</p>
      </section>
    </article>
  );
}
