import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/auth-actions';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import type { Theme } from '@/lib/theme';

export const metadata: Metadata = { title: 'Settings' };

const LINKS = [
  { href: '/settings/profile', label: 'Edit profile', hint: 'Name, username, bio, location and photos' },
  { href: '/settings/notifications', label: 'Notifications', hint: 'Choose what you get notified about' },
  { href: '/settings/privacy', label: 'Privacy', hint: 'Messages, search, leaderboard and your data' },
  { href: '/settings/account', label: 'Account', hint: 'Email, password and deleting your account' },
  { href: '/privacy', label: 'Privacy Policy', hint: 'How Pulse collects, stores and protects your information' },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;
  const { data: settings } = await supabase.from('user_settings').select('theme').eq('user_id', me.id).maybeSingle();
  const theme = (['light', 'dark', 'system'].includes(settings?.theme) ? settings?.theme : 'system') as Theme;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <section className="mt-6">
        <h2 className="font-display text-lg font-bold">Appearance</h2>
        <div className="mt-3">
          <ThemeSelector initial={theme} />
        </div>
      </section>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center justify-between gap-3 py-4 hover:bg-surface">
              <span>
                <span className="block font-semibold">{l.label}</span>
                <span className="block text-sm text-muted">{l.hint}</span>
              </span>
              <span aria-hidden="true" className="text-xl text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <form action={signOut} className="mt-8">
        <button className="w-full rounded-xl border border-line px-4 py-3 font-semibold hover:border-danger hover:text-danger">Sign out</button>
      </form>
    </div>
  );
}
