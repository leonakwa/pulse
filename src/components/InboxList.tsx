'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import { getInbox, INBOX_PAGE, type ConversationView } from '@/lib/conversations';
import { timeAgo } from '@/lib/time';

type Props = { initial: ConversationView[]; currentUserId: string };

export function InboxList({ initial, currentUserId }: Props) {
  const [items, setItems] = useState<ConversationView[]>(initial);
  const [canLoadMore, setCanLoadMore] = useState(initial.length >= INBOX_PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-read the newest conversations and keep any older ones already loaded.
  const refresh = useCallback(async () => {
    try {
      const fresh = await getInbox(createClient());
      setItems((prev) => {
        const oldest = fresh[fresh.length - 1]?.lastAt;
        const keep =
          fresh.length >= INBOX_PAGE && oldest
            ? prev.filter((c) => c.lastAt < oldest && !fresh.some((f) => f.id === c.id))
            : [];
        return [...fresh, ...keep];
      });
    } catch {
      /* keep what is on screen */
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel('inbox')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void refresh())
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last || loading) return;
    setLoading(true);
    setError(null);
    try {
      const older = await getInbox(createClient(), last.lastAt);
      setItems((prev) => [...prev, ...older.filter((o) => !prev.some((p) => p.id === o.id))]);
      setCanLoadMore(older.length >= INBOX_PAGE);
    } catch {
      setError('Could not load more conversations.');
    }
    setLoading(false);
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
        <p className="font-semibold">No messages yet</p>
        <p className="mt-1 text-sm text-muted">Tap New message to start a conversation.</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((c) => {
          const unread = c.unread > 0;
          return (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center gap-3 py-3">
                <Avatar name={c.other.fullName} url={c.other.avatarUrl} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate ${unread ? 'font-bold' : 'font-semibold'}`}>{c.other.fullName}</p>
                    <time dateTime={c.lastAt} suppressHydrationWarning className="shrink-0 text-xs text-muted">
                      {timeAgo(c.lastAt)}
                    </time>
                  </div>
                  <p className={`truncate text-sm ${unread ? 'font-semibold text-fg' : 'text-muted'}`}>
                    {c.lastSenderId === currentUserId ? 'You: ' : ''}
                    {c.lastBody}
                  </p>
                </div>
                {unread ? (
                  <span
                    aria-label={`${c.unread} unread`}
                    className="min-w-[1.25rem] shrink-0 rounded-full bg-brand px-1.5 text-center text-xs font-bold leading-5 text-brand-fg"
                  >
                    {c.unread > 9 ? '9+' : c.unread}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="py-2 text-center text-sm text-danger">
          {error}
        </p>
      ) : null}
      {canLoadMore ? (
        <div className="py-4 text-center">
          <button type="button" onClick={() => void loadMore()} disabled={loading} className="btn-ghost">
            {loading ? 'Loading...' : 'Load older conversations'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
