'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type Props = { profilePath: string; initialUnread: number };

// Inside a conversation the bar is hidden so the message box can sit at the bottom.
const THREAD_RE = /^\/messages\/[0-9a-f-]{36}$/i;

export function BottomNav({ profilePath, initialUnread }: Props) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);

  // Refresh the badge whenever you move to another page.
  useEffect(() => {
    createClient()
      .rpc('unread_conversation_count')
      .then(({ data }) => {
        if (typeof data === 'number') setUnread(data);
      });
  }, [pathname]);

  // ...and instantly when a new message arrives.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel('nav-unread')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
          supabase.rpc('unread_conversation_count').then(({ data: count }) => {
            if (typeof count === 'number') setUnread(count);
          });
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  if (THREAD_RE.test(pathname)) return null;

  const items = [
    {
      href: '/feed',
      label: 'Home',
      active: pathname === '/feed',
      icon: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    },
    {
      href: '/discover',
      label: 'Discover',
      active: pathname.startsWith('/discover'),
      icon: (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      ),
    },
    {
      href: '/messages',
      label: 'Messages',
      active: pathname.startsWith('/messages'),
      badge: unread,
      icon: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />,
    },
    {
      href: profilePath,
      label: 'Profile',
      active: pathname.startsWith('/u/') || pathname.startsWith('/settings'),
      icon: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </>
      ),
    },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-2xl">
        {items.map((item) => {
          const badge = 'badge' in item ? (item.badge ?? 0) : 0;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              aria-label={badge > 0 ? `${item.label}, ${badge} unread` : item.label}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${item.active ? 'text-brand' : 'text-muted'}`}
            >
              <span className="relative">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                {badge > 0 ? (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[1.1rem] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[1.1rem] text-brand-fg">
                    {badge > 9 ? '9+' : badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
