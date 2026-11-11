import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getPostsPage, type Scope } from '@/lib/posts';
import { Feed } from '@/components/Feed';

export const metadata: Metadata = { title: 'Home' };

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function FeedPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  const [{ data: profile }, { count: followingCount }] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url').eq('id', me.id).maybeSingle(),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', me.id),
  ]);

  // New users who follow nobody start on Discover so the feed is never empty for no reason.
  const scope: Scope =
    tab === 'following' ? 'following' : tab === 'discover' ? 'discover' : (followingCount ?? 0) > 0 ? 'following' : 'discover';

  const page = await getPostsPage(supabase, { scope, userId: me.id });

  const tabClass = (active: boolean) =>
    `flex-1 border-b-2 py-3 text-center text-sm font-semibold ${active ? 'border-brand text-fg' : 'border-transparent text-muted'}`;

  return (
    <div>
      <nav aria-label="Feed" className="-mx-4 -mt-4 mb-4 flex border-b border-line">
        <Link href="/feed?tab=following" aria-current={scope === 'following' ? 'page' : undefined} className={tabClass(scope === 'following')}>
          Following
        </Link>
        <Link href="/feed?tab=discover" aria-current={scope === 'discover' ? 'page' : undefined} className={tabClass(scope === 'discover')}>
          Discover
        </Link>
      </nav>

      <Feed
        key={scope}
        scope={scope}
        currentUserId={me.id}
        initialPosts={page.posts}
        initialCursor={page.nextCursor}
        composer={{ name: profile?.full_name ?? '', avatarUrl: profile?.avatar_url ?? null }}
        emptyTitle={scope === 'following' ? 'Nothing here yet' : 'No posts yet'}
        emptyText={
          scope === 'following'
            ? 'Posts from you and the people you follow will show up here.'
            : 'Be the first to post something.'
        }
      />
    </div>
  );
}
