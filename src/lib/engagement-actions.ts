'use server';

import { createClient } from '@/lib/supabase/server';
import { getCommentById, getCommentsPage, getRepliesPage, type CommentView, type CommentsPage } from '@/lib/comments';
import type { Cursor } from '@/lib/posts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

function friendly(error: { code?: string; message?: string } | null): string {
  const m = error?.message ?? '';
  if (m.includes('rate_limited')) return 'You are doing that too fast. Please wait a little and try again.';
  if (m.includes('reply_too_deep') || m.includes('invalid_parent')) return 'You cannot reply to that comment.';
  if (error?.code === '23503') return 'This is no longer available.';
  if (error?.code === '42501') return 'You are not allowed to do that.';
  return 'Something went wrong. Please try again.';
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function postCount(supabase: Db, postId: string, column: 'like_count' | 'comment_count') {
  const { data } = await supabase.from('posts').select('like_count, comment_count').eq('id', postId).maybeSingle();
  return data ? (data[column] as number) : 0;
}

async function commentLikeCount(supabase: Db, commentId: string) {
  const { data } = await supabase.from('post_comments').select('like_count').eq('id', commentId).maybeSingle();
  return Number(data?.like_count ?? 0);
}

function validCursor(cursor: Cursor | null): boolean {
  return cursor === null || (UUID_RE.test(cursor.id) && TS_RE.test(cursor.createdAt)); // it goes into a database filter
}

export async function toggleLike(postId: string, like: boolean): Promise<{ likeCount?: number; error?: string }> {
  if (!UUID_RE.test(postId)) return { error: 'Invalid post.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  if (like) {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
    if (error && error.code !== '23505') return { error: friendly(error) }; // 23505 = already liked, fine
  } else {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
    if (error) return { error: friendly(error) };
  }
  return { likeCount: await postCount(supabase, postId, 'like_count') };
}

export async function toggleCommentLike(commentId: string, like: boolean): Promise<{ likeCount?: number; error?: string }> {
  if (!UUID_RE.test(commentId)) return { error: 'Invalid comment.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  if (like) {
    const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
    if (error && error.code !== '23505') return { error: friendly(error) };
  } else {
    const { error } = await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
    if (error) return { error: friendly(error) };
  }
  return { likeCount: await commentLikeCount(supabase, commentId) };
}

export async function loadComments(postId: string, cursor: Cursor | null): Promise<CommentsPage | { error: string }> {
  if (!UUID_RE.test(postId) || !validCursor(cursor)) return { error: 'Invalid request.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };
  try {
    return await getCommentsPage(supabase, postId, user.id, cursor);
  } catch {
    return { error: 'Could not load comments. Please try again.' };
  }
}

export async function loadReplies(parentId: string, cursor: Cursor | null): Promise<CommentsPage | { error: string }> {
  if (!UUID_RE.test(parentId) || !validCursor(cursor)) return { error: 'Invalid request.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };
  try {
    return await getRepliesPage(supabase, parentId, user.id, cursor);
  } catch {
    return { error: 'Could not load replies. Please try again.' };
  }
}

// A normal comment, or (with parentId) a reply to a comment.
export async function addComment(
  postId: string,
  body: string,
  parentId?: string | null,
): Promise<{ comment?: CommentView; commentCount?: number; error?: string }> {
  if (!UUID_RE.test(postId)) return { error: 'Invalid post.' };
  if (parentId && !UUID_RE.test(parentId)) return { error: 'Invalid comment.' };
  const text = String(body ?? '').trim();
  if (text.length === 0) return { error: 'Write something first.' };
  if (text.length > 300) return { error: 'Comments can be up to 300 characters.' };

  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, author_id: user.id, body: text, parent_id: parentId ?? null })
    .select('id');
  const id = ((data ?? []) as { id: string }[])[0]?.id;
  if (error || !id) return { error: friendly(error) };

  const comment = await getCommentById(supabase, id, user.id);
  if (!comment) return { error: 'Your comment was saved but could not be loaded. Refresh the page.' };
  return { comment, commentCount: await postCount(supabase, postId, 'comment_count') };
}

export async function deleteComment(commentId: string): Promise<{ commentCount?: number; error?: string }> {
  if (!UUID_RE.test(commentId)) return { error: 'Invalid comment.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase.from('post_comments').delete().eq('id', commentId).eq('author_id', user.id).select('post_id');
  const postId = ((data ?? []) as { post_id: string }[])[0]?.post_id;
  if (error || !postId) return { error: 'Could not delete this. Please try again.' };
  return { commentCount: await postCount(supabase, postId, 'comment_count') };
}
