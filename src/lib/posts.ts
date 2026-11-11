import type { SupabaseClient } from '@supabase/supabase-js';

export const PAGE_SIZE = 10;

export type Scope = 'following' | 'discover' | 'author';
export type Cursor = { createdAt: string; id: string };

export type PostView = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: { id: string; username: string; fullName: string; avatarUrl: string | null };
  images: string[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type PostsPage = { posts: PostView[]; nextCursor: Cursor | null };

type RawAuthor = { username: string; full_name: string; avatar_url: string | null };
type RawPost = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  like_count: number;
  comment_count: number;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
  post_images: { storage_path: string; position: number }[] | null;
};

const SELECT =
  'id, body, created_at, edited_at, like_count, comment_count, author_id, author:profiles!author_id(username, full_name, avatar_url), post_images(storage_path, position)';

function toPostView(supabase: SupabaseClient, r: RawPost, liked: Set<string>): PostView {
  const a = Array.isArray(r.author) ? r.author[0] : r.author;
  const images = [...(r.post_images ?? [])]
    .sort((x, y) => x.position - y.position)
    .map((i) => supabase.storage.from('post-images').getPublicUrl(i.storage_path).data.publicUrl);
  return {
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    author: {
      id: r.author_id,
      username: a?.username ?? 'unknown',
      fullName: a?.full_name ?? 'Unknown',
      avatarUrl: a?.avatar_url ?? null,
    },
    images,
    likeCount: r.like_count ?? 0,
    commentCount: r.comment_count ?? 0,
    likedByMe: liked.has(r.id),
  };
}

// One extra query tells us which of these posts the viewer has liked.
async function getLikedIds(supabase: SupabaseClient, userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds);
  return new Set(((data ?? []) as { post_id: string }[]).map((r) => r.post_id));
}

// Newest first, 10 at a time. The cursor is (created_at, id) so paging stays correct as new posts arrive.
export async function getPostsPage(
  supabase: SupabaseClient,
  opts: { scope: Scope; userId: string; authorId?: string; cursor?: Cursor | null },
): Promise<PostsPage> {
  let query = supabase
    .from('posts')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (opts.scope === 'author' && opts.authorId) {
    query = query.eq('author_id', opts.authorId);
  }
  if (opts.scope === 'following') {
    const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', opts.userId).limit(1000);
    const ids = [opts.userId, ...((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)];
    query = query.in('author_id', ids);
  }
  if (opts.cursor) {
    const { createdAt, id } = opts.cursor;
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Could not load posts.');

  const rows = (data ?? []) as unknown as RawPost[];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const liked = await getLikedIds(supabase, opts.userId, pageRows.map((r) => r.id));
  const posts = pageRows.map((r) => toPostView(supabase, r, liked));
  const last = posts[posts.length - 1];

  return { posts, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null };
}

export async function getPostById(supabase: SupabaseClient, id: string, viewerId: string): Promise<PostView | null> {
  const { data } = await supabase.from('posts').select(SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const liked = await getLikedIds(supabase, viewerId, [id]);
  return toPostView(supabase, data as unknown as RawPost, liked);
}
