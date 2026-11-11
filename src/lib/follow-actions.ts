'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setFollow(targetId: string, follow: boolean): Promise<{ error?: string }> {
  if (!UUID_RE.test(targetId)) return { error: 'Invalid account.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  if (targetId === user.id) return { error: 'You cannot follow yourself.' };

  if (follow) {
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
    if (error && error.code !== '23505') { // 23505 = already following, fine
      return { error: error.message.includes('rate_limited') ? 'You are following too fast. Please wait a little.' : 'Could not follow this account.' };
    }
  } else {
    const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
    if (error) return { error: 'Could not unfollow this account.' };
  }

  revalidatePath('/', 'layout');
  return {};
}
