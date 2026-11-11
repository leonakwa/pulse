'use server';

import { createClient } from '@/lib/supabase/server';
import { getCommentById, getCommentsPage, type CommentView, type CommentsPage } from '@/lib/comments';
import type { Cursor } from '@/lib/posts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

function friendly(error: { code?: string; message?: string } | null): string {
  if (error?.message?.includes('rate_limited')) return 'You are doing that too fast. Please wait a little and try again.';
  if (error?.code === '23503') return 'This post is no longer available.';
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

async function countOf(supabase: Awaited<ReturnType<typeof createClient>>, postId: string, column: 'like_count' | 'comment_count') {
  const { data } = await supabase.from('posts').select('like_count, comment_count').eq('id', postId).maybeSingle();
  return data ? (data[column] as number) : 0;
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
  return { likeCount: await countOf(supabase, postId, 'like_count') };
}

export async function loadComments(postId: string, cursor: Cursor | null): Promise<CommentsPage | { error: string }> {
  if (!UUID_RE.test(postId)) return { error: 'Invalid post.' };
  if (cursor && (!UUID_RE.test(cursor.id) || !TS_RE.test(cursor.createdAt))) return { error: 'Invalid request.' }; // goes into a filter
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };
  try {
    return await getCommentsPage(supabase, postId, cursor);
  } catch {
    return { error: 'Could not load comments. Please try again.' };
  }
}

export async function addComment(postId: string, body: string): Promise<{ comment?: CommentView; commentCount?: number; error?: string }> {
  if (!UUID_RE.test(postId)) return { error: 'Invalid post.' };
  const text = String(body ?? '').trim();
  if (text.length === 0) return { error: 'Write a comment first.' };
  if (text.length > 300) return { error: 'Comments can be up to 300 characters.' };

  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: user.id, body: text }).select('id');
  const id = ((data ?? []) as { id: string }[])[0]?.id;
  if (error || !id) return { error: friendly(error) };

  const comment = await getCommentById(supabase, id);
  if (!comment) return { error: 'Your comment was saved but could not be loaded. Refresh the page.' };
  return { comment, commentCount: await countOf(supabase, postId, 'comment_count') };
}

export async function deleteComment(commentId: string): Promise<{ commentCount?: number; error?: string }> {
  if (!UUID_RE.test(commentId)) return { error: 'Invalid comment.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase.from('post_comments').delete().eq('id', commentId).eq('author_id', user.id).select('post_id');
  const postId = ((data ?? []) as { post_id: string }[])[0]?.post_id;
  if (error || !postId) return { error: 'Could not delete this comment. Please try again.' };
  return { commentCount: await countOf(supabase, postId, 'comment_count') };
}
