import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cursor } from '@/lib/posts';

export const COMMENT_PAGE = 10;
export const REPLY_PAGE = 5;

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null; // null for a top-level comment
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  author: { id: string; username: string; fullName: string; avatarUrl: string | null };
};
export type CommentsPage = { comments: CommentView[]; nextCursor: Cursor | null };

type RawAuthor = { username: string; full_name: string; avatar_url: string | null };
type RawComment = {
  id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  like_count: number;
  reply_count: number;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
};

const SELECT = 'id, body, created_at, parent_id, like_count, reply_count, author_id, author:profiles!author_id(username, full_name, avatar_url)';

function toCommentView(r: RawComment, liked: Set<string>): CommentView {
  const a = Array.isArray(r.author) ? r.author[0] : r.author;
  return {
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    parentId: r.parent_id,
    likeCount: r.like_count ?? 0,
    replyCount: r.reply_count ?? 0,
    likedByMe: liked.has(r.id),
    author: {
      id: r.author_id,
      username: a?.username ?? 'unknown',
      fullName: a?.full_name ?? 'Unknown',
      avatarUrl: a?.avatar_url ?? null,
    },
  };
}

async function getLikedIds(supabase: SupabaseClient, userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await supabase.from('comment_likes').select('comment_id').eq('user_id', userId).in('comment_id', ids);
  return new Set(((data ?? []) as { comment_id: string }[]).map((r) => r.comment_id));
}

async function toPage(supabase: SupabaseClient, viewerId: string, rows: RawComment[], size: number): Promise<CommentsPage> {
  const hasMore = rows.length > size;
  const slice = hasMore ? rows.slice(0, size) : rows;
  const liked = await getLikedIds(supabase, viewerId, slice.map((r) => r.id));
  const comments = slice.map((r) => toCommentView(r, liked));
  const last = comments[comments.length - 1];
  return { comments, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null };
}

// Top-level comments, oldest first, so a conversation reads top to bottom.
export async function getCommentsPage(supabase: SupabaseClient, postId: string, viewerId: string, cursor?: Cursor | null): Promise<CommentsPage> {
  let query = supabase
    .from('post_comments')
    .select(SELECT)
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(COMMENT_PAGE + 1);
  if (cursor) query = query.or(`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);

  const { data, error } = await query;
  if (error) throw new Error('Could not load comments.');
  return toPage(supabase, viewerId, (data ?? []) as unknown as RawComment[], COMMENT_PAGE);
}

export async function getRepliesPage(supabase: SupabaseClient, parentId: string, viewerId: string, cursor?: Cursor | null): Promise<CommentsPage> {
  let query = supabase
    .from('post_comments')
    .select(SELECT)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(REPLY_PAGE + 1);
  if (cursor) query = query.or(`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);

  const { data, error } = await query;
  if (error) throw new Error('Could not load replies.');
  return toPage(supabase, viewerId, (data ?? []) as unknown as RawComment[], REPLY_PAGE);
}

export async function getCommentById(supabase: SupabaseClient, id: string, viewerId: string): Promise<CommentView | null> {
  const { data } = await supabase.from('post_comments').select(SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const liked = await getLikedIds(supabase, viewerId, [id]);
  return toCommentView(data as unknown as RawComment, liked);
}
