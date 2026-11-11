import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cursor } from '@/lib/posts';

export const COMMENT_PAGE = 10;

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; fullName: string; avatarUrl: string | null };
};
export type CommentsPage = { comments: CommentView[]; nextCursor: Cursor | null };

type RawAuthor = { username: string; full_name: string; avatar_url: string | null };
type RawComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: RawAuthor | RawAuthor[] | null;
};

const SELECT = 'id, body, created_at, author_id, author:profiles!author_id(username, full_name, avatar_url)';

function toCommentView(r: RawComment): CommentView {
  const a = Array.isArray(r.author) ? r.author[0] : r.author;
  return {
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    author: {
      id: r.author_id,
      username: a?.username ?? 'unknown',
      fullName: a?.full_name ?? 'Unknown',
      avatarUrl: a?.avatar_url ?? null,
    },
  };
}

// Oldest first, so a conversation reads top to bottom.
export async function getCommentsPage(supabase: SupabaseClient, postId: string, cursor?: Cursor | null): Promise<CommentsPage> {
  let query = supabase
    .from('post_comments')
    .select(SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(COMMENT_PAGE + 1);

  if (cursor) {
    query = query.or(`created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Could not load comments.');

  const rows = (data ?? []) as unknown as RawComment[];
  const hasMore = rows.length > COMMENT_PAGE;
  const comments = (hasMore ? rows.slice(0, COMMENT_PAGE) : rows).map(toCommentView);
  const last = comments[comments.length - 1];
  return { comments, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null };
}

export async function getCommentById(supabase: SupabaseClient, id: string): Promise<CommentView | null> {
  const { data } = await supabase.from('post_comments').select(SELECT).eq('id', id).maybeSingle();
  return data ? toCommentView(data as unknown as RawComment) : null;
}
