import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cursor } from '@/lib/posts';

export const NOTIFICATION_PAGE = 20;
// Fired in the browser after notifications are read, so the bell updates straight away.
export const NOTIFICATIONS_CHANGED = 'pulse:notifications-changed';

export type NotificationType = 'follow' | 'like' | 'comment' | 'message' | 'level_up' | 'share';

export type NotificationView = {
  id: string;
  type: NotificationType;
  actor: { id: string; username: string; fullName: string; avatarUrl: string | null } | null;
  level: number | null;
  postId: string | null;
  conversationId: string | null;
  preview: string | null;
  read: boolean;
  createdAt: string;
};
export type NotificationsPage = { items: NotificationView[]; nextCursor: Cursor | null };

type RawActor = { username: string; full_name: string; avatar_url: string | null };
type RawNotification = {
  id: string;
  type: NotificationType;
  post_id: string | null;
  conversation_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
  actor_id: string | null;
  level: number | null;
  actor: RawActor | RawActor[] | null;
};

const SELECT =
  'id, type, post_id, conversation_id, preview, level, read_at, created_at, actor_id, actor:profiles!actor_id(username, full_name, avatar_url)';

function toView(r: RawNotification): NotificationView {
  const a = Array.isArray(r.actor) ? r.actor[0] : r.actor;
  return {
    id: r.id,
    type: r.type,
    actor: r.actor_id
      ? { id: r.actor_id, username: a?.username ?? 'unknown', fullName: a?.full_name ?? 'Someone', avatarUrl: a?.avatar_url ?? null }
      : null,
    level: r.level,
    postId: r.post_id,
    conversationId: r.conversation_id,
    preview: r.preview,
    read: r.read_at !== null,
    createdAt: r.created_at,
  };
}

// Where tapping a notification goes.
export function notificationHref(n: NotificationView): string {
  if (n.type === 'level_up') return '/xp';
  if (n.type === 'follow' && n.actor) return `/u/${n.actor.username}`;
  if (n.type === 'message' && n.conversationId) return `/messages/${n.conversationId}`;
  if (n.postId) return `/p/${n.postId}`;
  return '/notifications';
}

// Works with both the server and the browser client; the database only ever returns your own.
export async function getNotificationsPage(supabase: SupabaseClient, cursor?: Cursor | null): Promise<NotificationsPage> {
  let query = supabase
    .from('notifications')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATION_PAGE + 1);

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error('Could not load notifications.');

  const rows = (data ?? []) as unknown as RawNotification[];
  const hasMore = rows.length > NOTIFICATION_PAGE;
  const items = (hasMore ? rows.slice(0, NOTIFICATION_PAGE) : rows).map(toView);
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null };
}

export async function getNotificationById(supabase: SupabaseClient, id: string): Promise<NotificationView | null> {
  const { data } = await supabase.from('notifications').select(SELECT).eq('id', id).maybeSingle();
  return data ? toView(data as unknown as RawNotification) : null;
}
