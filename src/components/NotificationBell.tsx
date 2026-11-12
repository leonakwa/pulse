'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { NOTIFICATIONS_CHANGED } from '@/lib/notifications';

type Props = { userId: string; initialUnread: number };

export function NotificationBell({ userId, initialUnread }: Props) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);

  const refresh = useCallback(() => {
    createClient()
      .rpc('unread_notification_count')
      .then(({ data }) => {
        if (typeof data === 'number') setUnread(data);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
  }, [refresh]);

  // New notifications arrive live.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel('bell')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
          () => refresh(),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative rounded-lg p-2 text-muted transition hover:text-fg"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[1.1rem] text-brand-fg">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
