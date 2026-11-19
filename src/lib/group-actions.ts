'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanIds(list: unknown): string[] | null {
  if (!Array.isArray(list)) return null;
  const unique = [...new Set(list.map(String))];
  return unique.every((x) => UUID_RE.test(x)) ? unique : null;
}

function friendly(message?: string): string {
  const m = message ?? '';
  if (m.includes('cannot_add')) return 'One of the people you picked is not accepting messages or group invites from you.';
  if (m.includes('not_owner')) return 'Only the person who created the group can do that.';
  if (m.includes('group_full')) return 'A group can have up to 50 people.';
  if (m.includes('need_more_people')) return 'Pick at least 2 other people.';
  if (m.includes('invalid_name')) return 'Give the group a name (up to 60 characters).';
  if (m.includes('user_unavailable')) return 'One of the people you picked is not available.';
  if (m.includes('nobody_to_add')) return 'Those people are already in the group.';
  if (m.includes('rate_limited')) return 'You are creating groups too fast. Please wait a little.';
  if (m.includes('not_a_member')) return 'That person is not in this group.';
  return 'Something went wrong. Please try again.';
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createGroup(name: string, memberIds: string[]): Promise<{ id?: string; error?: string }> {
  const ids = cleanIds(memberIds);
  const title = String(name ?? '').trim();
  if (!ids) return { error: 'Invalid people.' };
  if (title.length < 1 || title.length > 60) return { error: 'Give the group a name (up to 60 characters).' };
  if (ids.length < 2) return { error: 'Pick at least 2 other people.' };

  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase.rpc('create_group_chat', { p_name: title, p_members: ids });
  if (error || typeof data !== 'string') return { error: friendly(error?.message) };
  revalidatePath('/messages');
  return { id: data };
}

export async function addMembers(conversationId: string, memberIds: string[]): Promise<{ error?: string }> {
  const ids = cleanIds(memberIds);
  if (!UUID_RE.test(conversationId) || !ids || ids.length === 0) return { error: 'Invalid request.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.rpc('add_group_members', { p_conversation: conversationId, p_members: ids });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/messages', 'layout');
  return {};
}

export async function removeMember(conversationId: string, userId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(conversationId) || !UUID_RE.test(userId)) return { error: 'Invalid request.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.rpc('remove_group_member', { p_conversation: conversationId, p_user: userId });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/messages', 'layout');
  return {};
}

export async function leaveGroup(conversationId: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(conversationId)) return { error: 'Invalid request.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.rpc('leave_group', { p_conversation: conversationId });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/messages', 'layout');
  return {};
}

export async function renameGroup(conversationId: string, name: string): Promise<{ error?: string }> {
  const title = String(name ?? '').trim();
  if (!UUID_RE.test(conversationId)) return { error: 'Invalid request.' };
  if (title.length < 1 || title.length > 60) return { error: 'Give the group a name (up to 60 characters).' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await supabase.rpc('rename_group', { p_conversation: conversationId, p_name: title });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/messages', 'layout');
  return {};
}
