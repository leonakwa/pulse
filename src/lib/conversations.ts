import type { SupabaseClient } from '@supabase/supabase-js';

export const INBOX_PAGE = 30;

export type ConversationView = {
  id: string;
  isGroup: boolean;
  title: string; // the group's name, or the other person's name
  avatarUrl: string | null;
  otherUsername: string | null;
  memberCount: number;
  lastBody: string;
  lastKind: string; // 'text' or 'system'
  lastSenderId: string;
  lastSenderName: string | null;
  lastAt: string;
  unread: number;
};

type Row = {
  conversation_id: string;
  is_group: boolean;
  group_name: string | null;
  member_count: number | string;
  other_id: string | null;
  other_username: string | null;
  other_full_name: string | null;
  other_avatar_url: string | null;
  last_body: string;
  last_kind: string;
  last_sender_id: string;
  last_sender_name: string | null;
  last_at: string;
  unread_count: number | string;
};

// Works with both the server and the browser client.
export async function getInbox(supabase: SupabaseClient, before?: string | null): Promise<ConversationView[]> {
  const { data, error } = await supabase.rpc('my_conversations', { p_limit: INBOX_PAGE, p_before: before ?? null });
  if (error) throw new Error('Could not load messages.');
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.conversation_id,
    isGroup: r.is_group,
    title: r.is_group ? (r.group_name ?? 'Group chat') : (r.other_full_name ?? 'Member'),
    avatarUrl: r.is_group ? null : r.other_avatar_url,
    otherUsername: r.other_username,
    memberCount: Number(r.member_count) || 0,
    lastBody: r.last_body,
    lastKind: r.last_kind,
    lastSenderId: r.last_sender_id,
    lastSenderName: r.last_sender_name,
    lastAt: r.last_at,
    unread: Number(r.unread_count) || 0,
  }));
}
