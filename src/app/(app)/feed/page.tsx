import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Home' };

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name')
    .eq('id', user!.id)
    .maybeSingle();

  return (
    <section className="py-6">
      <h1 className="font-display text-2xl font-bold">Welcome{profile ? `, ${profile.full_name}` : ''}</h1>
      {profile ? <p className="mt-1 text-muted">@{profile.username}</p> : null}
      <p className="mt-6 text-sm text-muted">You are signed in. Posting and the home feed are built in the next phase.</p>
    </section>
  );
}
