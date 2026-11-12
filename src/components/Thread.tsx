'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Avatar } from '@/components/Avatar';
import { ClientTime } from '@/components/ClientTime';
import { createClient } from '@/lib/supabase/client';
import { loadOlderMessages, markConversationRead, sendMessage } from '@/lib/message-actions';
import { toMessageView, type MessageView, type RawMessage } from '@/lib/messages';
import type { Cursor } from '@/lib/posts';

type Other = { id: string; username: string; fullName: string; avatarUrl: string | null };
type Props = {
  conversationId: string;
  currentUserId: string;
  other: Other;
  initialMessages: MessageView[];
  initialCursor: Cursor | null;
};

export function Thread({ conversationId, currentUserId, other, initialMessages, initialCursor }: Props) {
  const [messages, setMessages] = useState<MessageView[]>(initialMessages);
  const [cursor, setCursor] = useState<Cursor | null>(initialCursor);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const firstRun = useRef(true);

  const addMessage = (m: MessageView) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  // Remember whether the reader is at the bottom, so new messages only auto-scroll when they are.
  useEffect(() => {
    const onScroll = () => {
      nearBottom.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (prevHeight.current !== null) {
      // Older messages were added above: keep the reader where they were.
      window.scrollBy(0, document.documentElement.scrollHeight - prevHeight.current);
      prevHeight.current = null;
      return;
    }
    if (firstRun.current) {
      firstRun.current = false;
      bottomRef.current?.scrollIntoView({ block: 'end' });
      return;
    }
    if (nearBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId]);

  // Live updates: new messages in this conversation appear without refreshing.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`thread:${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const m = toMessageView(payload.new as RawMessage);
            addMessage(m);
            if (m.senderId !== currentUserId) void markConversationRead(conversationId);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    const res = await sendMessage(conversationId, value);
    setSending(false);
    if (res.error || !res.message) return setError(res.error ?? 'Your message was not sent.');
    nearBottom.current = true;
    addMessage(res.message);
    setText('');
  }

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);
    const res = await loadOlderMessages(conversationId, cursor);
    setLoadingOlder(false);
    if ('error' in res) return setError(res.error);
    prevHeight.current = document.documentElement.scrollHeight;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...res.messages.filter((m) => !seen.has(m.id)), ...prev];
    });
    setCursor(res.nextCursor);
  }

  return (
    <div className="-mb-24 flex min-h-[calc(100dvh-4.5rem)] flex-col">
      <div className="sticky top-14 z-[5] -mx-4 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        <Link href="/messages" aria-label="Back to messages" className="text-xl text-muted hover:text-fg">
          ←
        </Link>
        <Link href={`/u/${other.username}`} className="flex min-w-0 items-center gap-2">
          <Avatar name={other.fullName} url={other.avatarUrl} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold leading-tight">{other.fullName}</span>
            <span className="block truncate text-xs text-muted">@{other.username}</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 py-4">
        {cursor ? (
          <div className="pb-3 text-center">
            <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="btn-ghost">
              {loadingOlder ? 'Loading...' : 'Load earlier messages'}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Say hello to {other.fullName.split(' ')[0]}.</p>
        ) : null}

        <ul className="space-y-2">
          {messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <li key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine ? <Avatar name={other.fullName} url={other.avatarUrl} size={28} /> : null}
                <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <p
                    className={`whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-[15px] ${
                      mine ? 'rounded-br-md bg-brand text-brand-fg' : 'rounded-bl-md border border-line bg-surface'
                    }`}
                  >
                    {m.body}
                  </p>
                  <ClientTime iso={m.createdAt} className="mt-0.5 text-[11px] text-muted" />
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {error ? (
          <p role="alert" className="mb-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="message-input" className="sr-only">
            Message
          </label>
          <textarea
            id="message-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void send();
              }
            }}
            maxLength={2000}
            rows={1}
            placeholder="Write a message..."
            className="input max-h-32 resize-none !py-2.5"
          />
          <button
            type="submit"
            disabled={sending || text.trim() === ''}
            className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg disabled:opacity-60"
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
