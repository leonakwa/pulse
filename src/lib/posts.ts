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
};

export type PostsPage = { posts: PostView[]; nextCursor: Cursor | null };

type RawAuthor = { username: string; full_name: string; avatar_url: string | null };
type RawPost = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
  post_images: { storage_path: string; position: number }[] | null;
};

const SELECT =
  'id, body, created_at, edited_at, author_id, author:profiles!author_id(username, full_name, avatar_url), post_images(storage_path, position)';

function toPostView(supabase: SupabaseClient, r: RawPost): PostView {
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
  };
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
  const posts = pageRows.map((r) => toPostView(supabase, r));
  const last = posts[posts.length - 1];

  return { posts, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null };
}

export async function getPostById(supabase: SupabaseClient, id: string): Promise<PostView | null> {
  const { data } = await supabase.from('posts').select(SELECT).eq('id', id).maybeSingle();
  return data ? toPostView(supabase, data as unknown as RawPost) : null;
}
