import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cursor } from '@/lib/posts';

export const MESSAGE_PAGE = 30;

export type MessageView = { id: string; conversationId: string; senderId: string; body: string; createdAt: string };
export type MessagesPage = { messages: MessageView[]; nextCursor: Cursor | null }; // messages are oldest first

export type RawMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

export function toMessageView(r: RawMessage): MessageView {
  return { id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at };
}

// Newest 30 first (or the 30 before the cursor); returned oldest-first so they read top to bottom.
export async function getMessagesPage(supabase: SupabaseClient, conversationId: string, cursor?: Cursor | null): Promise<MessagesPage> {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MESSAGE_PAGE + 1);

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Could not load messages.');

  const rows = (data ?? []) as unknown as RawMessage[];
  const hasMore = rows.length > MESSAGE_PAGE;
  const page = hasMore ? rows.slice(0, MESSAGE_PAGE) : rows;
  const oldest = page[page.length - 1];

  return {
    messages: page.map(toMessageView).reverse(),
    nextCursor: hasMore && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
  };
}
