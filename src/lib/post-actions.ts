'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPostById, getPostsPage, type Cursor, type PostView, type PostsPage, type Scope } from '@/lib/posts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const SCOPES: Scope[] = ['following', 'discover', 'author'];

function friendly(message: string | undefined): string {
  const m = message ?? '';
  if (m.includes('rate_limited')) return 'You are posting too fast. Please wait a little and try again.';
  if (m.includes('empty_post')) return 'Write something or add a photo first.';
  if (m.includes('body_too_long')) return 'Posts can be up to 500 characters.';
  if (m.includes('too_many_images')) return 'You can add up to 4 photos.';
  if (m.includes('image_missing')) return 'One of your photos did not upload. Please try again.';
  if (m.includes('account_unavailable')) return 'This account cannot post right now.';
  return 'Something went wrong. Please try again.';
}

export async function loadMorePosts(scope: Scope, authorId: string | null, cursor: Cursor): Promise<PostsPage | { error: string }> {
  // The cursor goes into a database filter, so it is strictly validated.
  if (!SCOPES.includes(scope) || !UUID_RE.test(cursor?.id ?? '') || !TS_RE.test(cursor?.createdAt ?? '')) {
    return { error: 'Invalid request.' };
  }
  if (authorId !== null && !UUID_RE.test(authorId)) return { error: 'Invalid request.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  try {
    return await getPostsPage(supabase, { scope, userId: user.id, authorId: authorId ?? undefined, cursor });
  } catch {
    return { error: 'Could not load more posts. Please try again.' };
  }
}

// Called AFTER the browser uploaded the images. The database function checks everything and saves
// the post and images together, or nothing at all.
export async function createPost(body: string, imagePaths: string[]): Promise<{ post?: PostView; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const paths = Array.isArray(imagePaths) ? imagePaths.filter((p) => typeof p === 'string') : [];
  const { data: postId, error } = await supabase.rpc('create_post', { p_body: String(body ?? ''), p_image_paths: paths });

  if (error || typeof postId !== 'string') {
    // Nothing was saved, so remove any files that were uploaded for this post.
    const own = paths.filter((p) => p.startsWith(`${user.id}/`));
    if (own.length) await supabase.storage.from('post-images').remove(own);
    return { error: friendly(error?.message) };
  }

  const post = await getPostById(supabase, postId);
  if (!post) return { error: 'Your post was saved but could not be loaded. Refresh the page.' };

  revalidatePath('/', 'layout');
  return { post };
}

export async function updatePost(postId: string, body: string): Promise<{ body?: string; editedAt?: string | null; error?: string }> {
  if (!UUID_RE.test(postId)) return { error: 'Invalid post.' };
  const text = String(body ?? '').trim();
  if (text.length > 500) return { error: 'Posts can be up to 500 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase
    .from('posts')
    .update({ body: text })
    .eq('id', postId)
    .eq('author_id', user.id)
    .select('body, edited_at');

  const row = ((data ?? []) as unknown as { body: string; edited_at: string | null }[])[0];
  if (error || !row) return { error: friendly(error?.message) };

  revalidatePath('/', 'layout');
  return { body: row.body, editedAt: row.edited_at };
}

export async function deletePost(postId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(postId)) return { error: 'Invalid post.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data: images } = await supabase.from('post_images').select('storage_path').eq('post_id', postId);

  const { data: deleted, error } = await supabase.from('posts').delete().eq('id', postId).eq('author_id', user.id).select('id');
  if (error || !deleted || deleted.length === 0) return { error: 'Could not delete this post. Please try again.' };

  // Remove the image files too (best effort).
  const paths = ((images ?? []) as { storage_path: string }[]).map((r) => r.storage_path).filter((p) => p.startsWith(`${user.id}/`));
  if (paths.length) await supabase.storage.from('post-images').remove(paths);

  revalidatePath('/', 'layout');
  return {};
}
