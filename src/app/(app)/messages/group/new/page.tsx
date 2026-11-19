import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { GroupCreator } from '@/components/GroupCreator';

export const metadata: Metadata = { title: 'New group' };

export default async function NewGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <Link href="/messages" className="text-sm font-medium text-muted hover:text-fg">
        ← Messages
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">New group chat</h1>
      <p className="mt-1 text-sm text-muted">
        Give it a name and add at least 2 people. You will be the owner and can add or remove people later. People are only added if they accept messages from you.
      </p>
      <div className="mt-6">
        <GroupCreator userId={user!.id} />
      </div>
    </div>
  );
}
