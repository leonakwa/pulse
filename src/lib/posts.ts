import type { SupabaseClient } from '@supabase/supabase-js';

export const PAGE_SIZE = 10;

export type Scope = 'following' | 'discover' | 'author';
export type Cursor = { createdAt: string; id: string };

type Author = { id: string; username: string; fullName: string; avatarUrl: string | null };

// The original post inside a share.
export type SharedPostView = { id: string; body: string; createdAt: string; author: Author; images: string[] };
// What "Share" acts on: the post itself, or (for a share) the original it points to.
export type ShareTarget = { id: string; authorId: string; authorName: string; username: string; body: string };

export type PostView = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: Author;
  images: string[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isShare: boolean;
  sharedPost: SharedPostView | null; // null when not a share, or when the original is gone
  shareCount: number; // times the ORIGINAL has been shared
  sharedByMe: boolean;
  shareTarget: ShareTarget | null;
};

export type PostsPage = { posts: PostView[]; nextCursor: Cursor | null };

type RawAuthor = { username: string; full_name: string; avatar_url: string | null };
type RawImages = { storage_path: string; position: number }[] | null;
type RawOriginal = {
  id: string;
  body: string;
  created_at: string;
  share_count: number;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
  post_images: RawImages;
};
type RawPost = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_share: boolean;
  shared_post_id: string | null;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
  post_images: RawImages;
  original: RawOriginal | RawOriginal[] | null;
};

const AUTHOR = 'author:profiles!author_id(username, full_name, avatar_url)';
const SELECT =
  `id, body, created_at, edited_at, like_count, comment_count, share_count, is_share, shared_post_id, author_id, ${AUTHOR}, post_images(storage_path, position), ` +
  `original:posts!shared_post_id(id, body, created_at, share_count, author_id, ${AUTHOR}, post_images(storage_path, position))`;

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function imageUrls(supabase: SupabaseClient, images: RawImages): string[] {
  return [...(images ?? [])]
    .sort((x, y) => x.position - y.position)
    .map((i) => supabase.storage.from('post-images').getPublicUrl(i.storage_path).data.publicUrl);
}

function authorOf(id: string, a: RawAuthor | null): Author {
  return { id, username: a?.username ?? 'unknown', fullName: a?.full_name ?? 'Unknown', avatarUrl: a?.avatar_url ?? null };
}

function targetIdOf(r: RawPost): string | null {
  return r.is_share ? (one(r.original)?.id ?? null) : r.id;
}

function toPostView(supabase: SupabaseClient, r: RawPost, liked: Set<string>, shared: Set<string>): PostView {
  const author = authorOf(r.author_id, one(r.author));
  const orig = one(r.original);
  const origAuthor = orig ? authorOf(orig.author_id, one(orig.author)) : null;

  const sharedPost: SharedPostView | null =
    r.is_share && orig && origAuthor
      ? { id: orig.id, body: orig.body, createdAt: orig.created_at, author: origAuthor, images: imageUrls(supabase, orig.post_images) }
      : null;

  const shareTarget: ShareTarget | null = r.is_share
    ? orig && origAuthor
      ? { id: orig.id, authorId: origAuthor.id, authorName: origAuthor.fullName, username: origAuthor.username, body: orig.body }
      : null
    : { id: r.id, authorId: author.id, authorName: author.fullName, username: author.username, body: r.body };

  return {
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    author,
    images: imageUrls(supabase, r.post_images),
    likeCount: r.like_count ?? 0,
    commentCount: r.comment_count ?? 0,
    likedByMe: liked.has(r.id),
    isShare: r.is_share,
    sharedPost,
    shareCount: r.is_share ? (orig?.share_count ?? 0) : (r.share_count ?? 0),
    sharedByMe: shareTarget ? shared.has(shareTarget.id) : false,
    shareTarget,
  };
}

// Which of these posts has the viewer liked?
async function getLikedIds(supabase: SupabaseClient, userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds);
  return new Set(((data ?? []) as { post_id: string }[]).map((r) => r.post_id));
}

// Which of these originals has the viewer already shared?
async function getSharedIds(supabase: SupabaseClient, userId: string, targetIds: string[]): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const { data } = await supabase
    .from('posts')
    .select('shared_post_id')
    .eq('author_id', userId)
    .eq('is_share', true)
    .in('shared_post_id', targetIds);
  return new Set(((data ?? []) as { shared_post_id: string }[]).map((r) => r.shared_post_id));
}

async function toViews(supabase: SupabaseClient, viewerId: string, rows: RawPost[]): Promise<PostView[]> {
  const targets = rows.map(targetIdOf).filter((x): x is string => Boolean(x));
  const [liked, shared] = await Promise.all([
    getLikedIds(supabase, viewerId, rows.map((r) => r.id)),
    getSharedIds(supabase, viewerId, targets),
  ]);
  return rows.map((r) => toPostView(supabase, r, liked, shared));
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
  const posts = await toViews(supabase, opts.userId, hasMore ? rows.slice(0, PAGE_SIZE) : rows);
  const last = posts[posts.length - 1];

  return { posts, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null };
}

export async function getPostById(supabase: SupabaseClient, id: string, viewerId: string): Promise<PostView | null> {
  const { data } = await supabase.from('posts').select(SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const [view] = await toViews(supabase, viewerId, [data as unknown as RawPost]);
  return view ?? null;
}

// Most-liked original posts from the last 30 days (falls back to newest when nothing has likes yet).
export async function getPopularPosts(supabase: SupabaseClient, viewerId: string, limit = 10): Promise<PostView[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('posts')
    .select(SELECT)
    .eq('is_share', false)
    .gte('created_at', since)
    .order('like_count', { ascending: false })
    .order('comment_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('Could not load posts.');
  return toViews(supabase, viewerId, (data ?? []) as unknown as RawPost[]);
}
