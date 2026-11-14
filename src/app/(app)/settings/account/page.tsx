import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountForm } from '@/components/settings/AccountForms';

export const metadata: Metadata = { title: 'Account settings' };

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/settings" className="text-sm font-medium text-muted hover:text-fg">
          ← Settings
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold">Account</h1>
      </div>

      <section>
        <h2 className="font-display text-lg font-bold">Email</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Only you and PulseHive administrators can see your email address.</p>
        <ChangeEmailForm currentEmail={user?.email ?? ''} />
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Password</h2>
        <p className="mb-3 mt-1 text-sm text-muted">PulseHive never stores or shows your password.</p>
        <ChangePasswordForm />
      </section>

      <section className="rounded-2xl border border-danger/40 p-4">
        <h2 className="font-display text-lg font-bold text-danger">Delete account</h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          This permanently deletes your account, profile, posts, comments, likes, follows, XP and the messages you sent, and removes your
          photos. Shares of your posts will show &ldquo;no longer available&rdquo;. It cannot be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
