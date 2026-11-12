import type { SupabaseClient } from '@supabase/supabase-js';

export const INBOX_PAGE = 30;

export type ConversationView = {
  id: string;
  other: { id: string; username: string; fullName: string; avatarUrl: string | null };
  lastBody: string;
  lastSenderId: string;
  lastAt: string;
  unread: number;
};

type Row = {
  conversation_id: string;
  other_id: string;
  other_username: string;
  other_full_name: string;
  other_avatar_url: string | null;
  last_body: string;
  last_sender_id: string;
  last_at: string;
  unread_count: number | string;
};

// Works with both the server and the browser client.
export async function getInbox(supabase: SupabaseClient, before?: string | null): Promise<ConversationView[]> {
  const { data, error } = await supabase.rpc('my_conversations', { p_limit: INBOX_PAGE, p_before: before ?? null });
  if (error) throw new Error('Could not load messages.');
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.conversation_id,
    other: { id: r.other_id, username: r.other_username, fullName: r.other_full_name, avatarUrl: r.other_avatar_url },
    lastBody: r.last_body,
    lastSenderId: r.last_sender_id,
    lastAt: r.last_at,
    unread: Number(r.unread_count) || 0,
  }));
}
