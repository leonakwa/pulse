'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPostById, type PostView } from '@/lib/posts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function friendly(message?: string): string {
  const m = message ?? '';
  if (m.includes('own_post')) return 'You cannot share your own post.';
  if (m.includes('already_shared')) return 'You already shared this post.';
  if (m.includes('post_not_found')) return 'This post is no longer available.';
  if (m.includes('rate_limited')) return 'You are posting too fast. Please wait a little and try again.';
  if (m.includes('body_too_long')) return 'Comments can be up to 500 characters.';
  if (m.includes('account_unavailable')) return 'This account cannot share right now.';
  return 'Something went wrong. Please try again.';
}

async function countOf(supabase: Awaited<ReturnType<typeof createClient>>, postId: string): Promise<number> {
  const { data } = await supabase.from('posts').select('share_count').eq('id', postId).maybeSingle();
  return Number(data?.share_count ?? 0);
}

// Shares the ORIGINAL post (targetId) to your followers, with an optional comment.
export async function sharePost(targetId: string, comment: string): Promise<{ post?: PostView; shareCount?: number; error?: string }> {
  if (!UUID_RE.test(targetId)) return { error: 'Invalid post.' };
  const text = String(comment ?? '').trim();
  if (text.length > 500) return { error: 'Comments can be up to 500 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data: newId, error } = await supabase.rpc('share_post', { p_post: targetId, p_comment: text });
  if (error || typeof newId !== 'string') return { error: friendly(error?.message) };

  const post = await getPostById(supabase, newId, user.id);
  revalidatePath('/', 'layout');
  return { post: post ?? undefined, shareCount: await countOf(supabase, targetId) };
}

export async function unsharePost(targetId: string): Promise<{ shareCount?: number; removedId?: string; error?: string }> {
  if (!UUID_RE.test(targetId)) return { error: 'Invalid post.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('author_id', user.id)
    .eq('is_share', true)
    .eq('shared_post_id', targetId)
    .select('id');
  const removed = ((data ?? []) as { id: string }[])[0];
  if (error || !removed) return { error: 'Could not undo your share. Please try again.' };

  revalidatePath('/', 'layout');
  return { shareCount: await countOf(supabase, targetId), removedId: removed.id };
}
