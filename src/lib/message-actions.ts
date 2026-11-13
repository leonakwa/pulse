'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMessagesPage, toMessageView, type MessageView, type MessagesPage, type RawMessage } from '@/lib/messages';
import type { Cursor } from '@/lib/posts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

// Used directly as a form action (the "Message" buttons).
export async function startConversation(formData: FormData) {
  const userId = String(formData.get('userId') ?? '');
  if (!UUID_RE.test(userId)) redirect('/messages?error=start');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('start_conversation', { p_other: userId });
  if (error?.message?.includes('messages_not_allowed')) redirect('/messages?error=blocked');
  if (error || typeof data !== 'string') redirect('/messages?error=start');
  redirect(`/messages/${data}`);
}

export async function sendMessage(conversationId: string, body: string): Promise<{ message?: MessageView; error?: string }> {
  if (!UUID_RE.test(conversationId)) return { error: 'Invalid conversation.' };
  const text = String(body ?? '').trim();
  if (text.length === 0) return { error: 'Write a message first.' };
  if (text.length > 2000) return { error: 'Messages can be up to 2000 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
    .select('id, conversation_id, sender_id, body, created_at');

  const row = ((data ?? []) as unknown as RawMessage[])[0];
  if (error || !row) {
    if (error?.message?.includes('messages_not_allowed')) return { error: 'This person is not accepting messages from you.' };
    if (error?.message?.includes('rate_limited')) return { error: 'You are sending messages too fast. Wait a moment.' };
    if (error?.code === '42501') return { error: 'You cannot send messages in this conversation.' };
    return { error: 'Your message was not sent. Please try again.' };
  }
  return { message: toMessageView(row) };
}

export async function loadOlderMessages(conversationId: string, cursor: Cursor): Promise<MessagesPage | { error: string }> {
  if (!UUID_RE.test(conversationId) || !UUID_RE.test(cursor?.id ?? '') || !TS_RE.test(cursor?.createdAt ?? '')) {
    return { error: 'Invalid request.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  try {
    return await getMessagesPage(supabase, conversationId, cursor);
  } catch {
    return { error: 'Could not load earlier messages.' };
  }
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!UUID_RE.test(conversationId)) return;
  const supabase = await createClient();
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}
