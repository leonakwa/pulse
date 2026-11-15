import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MfaSetup } from '@/components/settings/MfaSetup';

export const metadata: Metadata = { title: 'Two-step login' };

type Props = { searchParams: Promise<{ admin?: string }> };

export default async function SecuritySettingsPage({ searchParams }: Props) {
  const { admin } = await searchParams;
  const supabase = await createClient();

  // For now only administrators can use this (there is no email recovery for lost phones yet).
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) notFound();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.[0];

  return (
    <div>
      <Link href="/settings" className="text-sm font-medium text-muted hover:text-fg">
        ← Settings
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Two-step login</h1>
      <p className="mt-1 text-sm text-muted">
        Protects the admin area. Even if someone learns your password, they cannot get in without the code on your phone.
      </p>

      {admin === '1' ? (
        <p role="status" className="mt-4 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
          The admin area needs two-step login. Set it up below, then open Admin again.
        </p>
      ) : null}

      <div className="mt-6">
        <MfaSetup enabledFactorId={verified?.id ?? null} />
      </div>

      <section className="mt-8 rounded-2xl border border-line p-4 text-sm">
        <p className="font-semibold">Keep your key safe</p>
        <p className="mt-1 text-muted">
          If you lose your phone, you cannot sign in to the admin area without it. Save the setup key shown during setup somewhere safe,
          so you can add the account to a new phone.
        </p>
      </section>
    </div>
  );
}
