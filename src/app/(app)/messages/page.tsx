import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getInbox } from '@/lib/conversations';
import { InboxList } from '@/components/InboxList';

export const metadata: Metadata = { title: 'Messages' };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function MessagesPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  const inbox = await getInbox(supabase);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Messages</h1>
        <Link href="/messages/new" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg">
          New message
        </Link>
      </div>

      {error === 'start' ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Could not start that conversation. Please try again.
        </p>
      ) : null}

      {error === 'blocked' ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          This person is not accepting messages from you.
        </p>
      ) : null}

      <InboxList initial={inbox} currentUserId={me.id} />
    </div>
  );
}
