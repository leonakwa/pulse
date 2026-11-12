import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPostsPage } from '@/lib/posts';
import { Avatar } from '@/components/Avatar';
import { Feed } from '@/components/Feed';
import { FollowButton } from '@/components/FollowButton';
import { MessageButton } from '@/components/MessageButton';

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
  const me = user!;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, bio, location, avatar_url, cover_url, created_at')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (!profile) notFound();

  const isOwn = me.id === profile.id;

  const [followers, following, postCount, page, iFollow] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', profile.id),
    getPostsPage(supabase, { scope: 'author', userId: me.id, authorId: profile.id }),
    isOwn
      ? Promise.resolve({ count: 0 })
      : supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', me.id).eq('following_id', profile.id),
  ]);

  const joined = new Date(profile.created_at).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const base = `/u/${profile.username}`;

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
        <div className="mb-1">
          {isOwn ? (
            <Link href="/settings/profile" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">
              Edit profile
            </Link>
          ) : (
            <div className="flex items-start gap-2">
              <MessageButton userId={profile.id} />
              <FollowButton targetId={profile.id} initialFollowing={(iFollow.count ?? 0) > 0} />
            </div>
          )}
        </div>
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
            <dt className="sr-only">Posts</dt>
            <dd>
              <span className="font-bold">{postCount.count ?? 0}</span> <span className="text-muted">Posts</span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Followers</dt>
            <dd>
              <Link href={`${base}/followers`} className="hover:underline">
                <span className="font-bold">{followers.count ?? 0}</span> <span className="text-muted">Followers</span>
              </Link>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Following</dt>
            <dd>
              <Link href={`${base}/following`} className="hover:underline">
                <span className="font-bold">{following.count ?? 0}</span> <span className="text-muted">Following</span>
              </Link>
            </dd>
          </div>
        </dl>
      </div>

      <section className="mt-6 border-t border-line">
        <Feed
          scope="author"
          authorId={profile.id}
          currentUserId={me.id}
          initialPosts={page.posts}
          initialCursor={page.nextCursor}
          emptyTitle="No posts yet"
          emptyText={isOwn ? 'Share your first post from the Home tab.' : 'This person has not posted yet.'}
        />
      </section>
    </article>
  );
}
