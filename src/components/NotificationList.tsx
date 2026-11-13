'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import {
  getNotificationById,
  getNotificationsPage,
  notificationHref,
  NOTIFICATIONS_CHANGED,
  type NotificationView,
} from '@/lib/notifications';
import { timeAgo } from '@/lib/time';
import type { Cursor } from '@/lib/posts';

type Props = { userId: string; initialItems: NotificationView[]; initialCursor: Cursor | null };

const VERBS: Record<NotificationView['type'], string> = {
  follow: 'started following you',
  like: 'liked your post',
  comment: 'commented on your post',
  message: 'sent you a message',
  share: 'shared your post',
  level_up: '',
};

export function NotificationList({ userId, initialItems, initialCursor }: Props) {
  const [items, setItems] = useState<NotificationView[]>(initialItems);
  const [cursor, setCursor] = useState<Cursor | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = items.filter((n) => !n.read).length;
  const announce = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

  // New notifications appear at the top without refreshing.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel('notification-list')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
          async (payload) => {
            const created = await getNotificationById(supabase, (payload.new as { id: string }).id);
            if (created) setItems((prev) => (prev.some((n) => n.id === created.id) ? prev : [created, ...prev]));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);

  function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    createClient()
      .rpc('mark_notification_read', { p_id: id })
      .then(() => announce());
  }

  async function markAllRead() {
    setError(null);
    const { error: rpcError } = await createClient().rpc('mark_all_notifications_read');
    if (rpcError) return setError('Could not mark notifications as read. Please try again.');
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    announce();
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await getNotificationsPage(createClient(), cursor);
      setItems((prev) => [...prev, ...page.items.filter((n) => !prev.some((p) => p.id === n.id))]);
      setCursor(page.nextCursor);
    } catch {
      setError('Could not load more notifications.');
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 ? <p className="text-sm text-muted">{unreadCount} unread</p> : null}
        </div>
        {unreadCount > 0 ? (
          <button type="button" onClick={() => void markAllRead()} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">
            Mark all as read
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-semibold">No notifications yet</p>
          <p className="mt-1 text-sm text-muted">You will see new followers, likes, comments and messages here.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-1">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={notificationHref(n)}
                onClick={() => {
                  if (!n.read) markRead(n.id);
                }}
                className={`flex items-start gap-3 rounded-xl px-3 py-3 ${n.read ? 'hover:bg-surface' : 'bg-brand/10'}`}
              >
                {n.actor ? (
                  <Avatar name={n.actor.fullName} url={n.actor.avatarUrl} size={44} />
                ) : (
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-brand-fg">
                    ★
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">
                    {n.type === 'level_up' ? (
                      <span className="font-semibold">
                        You reached Level {n.level}: {n.preview}
                      </span>
                    ) : (
                      <>
                        <span className="font-semibold">{n.actor?.fullName ?? 'Someone'}</span> {VERBS[n.type]}
                      </>
                    )}
                  </p>
                  {n.type === 'comment' && n.preview ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">&ldquo;{n.preview}&rdquo;</p> : null}
                  <time dateTime={n.createdAt} suppressHydrationWarning className="mt-0.5 block text-xs text-muted">
                    {timeAgo(n.createdAt)}
                  </time>
                </div>
                {!n.read ? <span aria-label="Unread" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <div className="py-4 text-center">
          <button type="button" onClick={() => void loadMore()} disabled={loading} className="btn-ghost">
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
