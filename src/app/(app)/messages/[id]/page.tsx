import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMessagesPage } from '@/lib/messages';
import { Thread, type GroupInfo } from '@/components/Thread';

export const metadata: Metadata = { title: 'Conversation' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };
type ProfileBits = { username: string; full_name: string; avatar_url: string | null };
type MemberRow = { user_id: string; role: string; profile: ProfileBits | ProfileBits[] | null };

export default async function ConversationPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  // Row Level Security means this only finds conversations you are part of.
  const { data: conversation } = await supabase.from('conversations').select('id, is_group, name').eq('id', id).maybeSingle();
  if (!conversation) notFound();

  let other: { id: string; username: string; fullName: string; avatarUrl: string | null } | null = null;
  let group: GroupInfo | null = null;

  if (conversation.is_group) {
    const { data: rows } = await supabase
      .from('conversation_participants')
      .select('user_id, role, profile:profiles!user_id(username, full_name, avatar_url)')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    const members = ((rows ?? []) as unknown as MemberRow[])
      .map((r) => {
        const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
        return p
          ? { id: r.user_id, username: p.username, fullName: p.full_name, avatarUrl: p.avatar_url, role: (r.role === 'owner' ? 'owner' : 'member') as 'owner' | 'member' }
          : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const mine = members.find((m) => m.id === me.id);
    if (!mine) notFound();
    group = { name: conversation.name ?? 'Group chat', myRole: mine.role, members };
  } else {
    const { data: others } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id)
      .neq('user_id', me.id);
    const otherId = ((others ?? []) as { user_id: string }[])[0]?.user_id;
    if (!otherId) notFound();

    const { data: person } = await supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', otherId).maybeSingle();
    if (!person) notFound();
    other = { id: person.id, username: person.username, fullName: person.full_name, avatarUrl: person.avatar_url };
  }

  const page = await getMessagesPage(supabase, id);
  await supabase.rpc('mark_conversation_read', { p_conversation_id: id });

  return (
    <Thread
      conversationId={id}
      currentUserId={me.id}
      other={other}
      group={group}
      initialMessages={page.messages}
      initialCursor={page.nextCursor}
    />
  );
}
