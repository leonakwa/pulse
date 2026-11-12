import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/auth-actions';
import { Wordmark } from '@/components/Wordmark';
import { NotificationBell } from '@/components/NotificationBell';
import { BottomNav } from '@/components/BottomNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('status, username').eq('id', user.id).maybeSingle();
  const { data: unread } = await supabase.rpc('unread_conversation_count');
  const { data: unreadNotifications } = await supabase.rpc('unread_notification_count');

  // Suspended or deactivated accounts cannot use the app.
  if (profile && profile.status !== 'active') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl font-bold">Account unavailable</h1>
        <p className="text-muted">This account has been suspended or deactivated.</p>
        <form action={signOut}>
          <button className="btn-ghost">Sign out</button>
        </form>
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <Wordmark className="!text-2xl" />
        <div className="flex items-center gap-1">
          <Link href="/leaderboard" aria-label="Leaderboard" className="rounded-lg p-2 text-muted transition hover:text-fg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
            </svg>
          </Link>
          <NotificationBell userId={user.id} initialUnread={typeof unreadNotifications === 'number' ? unreadNotifications : 0} />
          <form action={signOut}>
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </header>
      <main className="p-4 pb-24">{children}</main>
      <BottomNav profilePath={profile ? `/u/${profile.username}` : '/feed'} initialUnread={typeof unread === 'number' ? unread : 0} />
    </div>
  );
}
