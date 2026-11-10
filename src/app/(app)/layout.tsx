import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/auth-actions';
import { Wordmark } from '@/components/Wordmark';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).maybeSingle();

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
        <form action={signOut}>
          <button className="btn-ghost">Sign out</button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
