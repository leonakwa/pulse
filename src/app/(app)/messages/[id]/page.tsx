import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMessagesPage } from '@/lib/messages';
import { Thread } from '@/components/Thread';

export const metadata: Metadata = { title: 'Conversation' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  // Row Level Security means this only finds conversations you are part of.
  const { data: conversation } = await supabase.from('conversations').select('id').eq('id', id).maybeSingle();
  if (!conversation) notFound();

  const { data: others } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', id)
    .neq('user_id', me.id);
  const otherId = ((others ?? []) as { user_id: string }[])[0]?.user_id;
  if (!otherId) notFound();

  const { data: other } = await supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', otherId).maybeSingle();
  if (!other) notFound();

  const page = await getMessagesPage(supabase, id);
  await supabase.rpc('mark_conversation_read', { p_conversation_id: id });

  return (
    <Thread
      conversationId={id}
      currentUserId={me.id}
      other={{ id: other.id, username: other.username, fullName: other.full_name, avatarUrl: other.avatar_url }}
      initialMessages={page.messages}
      initialCursor={page.nextCursor}
    />
  );
}
