'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/form-state';

// Two-step login uses an authenticator app (Google Authenticator, Authy, Microsoft Authenticator, 1Password...).
// For now it is for admins only: there is no email recovery yet, so we do not offer it to everyone.

async function adminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin } = await supabase.rpc('is_admin');
  return { supabase, user, isAdmin: isAdmin === true };
}

export async function startMfaEnroll(): Promise<{ factorId?: string; qr?: string; secret?: string; error?: string }> {
  const { supabase, user, isAdmin } = await adminContext();
  if (!user) return { error: 'Please sign in again.' };
  if (!isAdmin) return { error: 'Two-step login is only available to administrators for now.' };

  // Clear any half-finished setup first.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `PulseHive ${Date.now()}`, issuer: 'PulseHive' });
  if (error || !data) return { error: 'Could not start the setup. Please try again.' };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmMfaEnroll(factorId: string, code: string): Promise<{ error?: string }> {
  const clean = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const { supabase, user, isAdmin } = await adminContext();
  if (!user || !isAdmin) return { error: 'Not allowed.' };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return { error: 'Could not check your code. Please try again.' };
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: clean });
  if (error) return { error: 'That code is not correct. Wait for a new code and try again.' };

  revalidatePath('/', 'layout');
  return {};
}

export async function disableMfa(factorId: string): Promise<{ error?: string }> {
  const { supabase, user, isAdmin } = await adminContext();
  if (!user || !isAdmin) return { error: 'Not allowed.' };
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: 'Could not turn it off. Sign in again with your code and retry.' };
  revalidatePath('/', 'layout');
  return {};
}

// The second step when signing in.
export async function verifyMfaLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get('code') ?? '').replace(/\s/g, '');
  const requested = String(formData.get('next') ?? '/feed');
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/feed';
  if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your sign-in expired. Please sign in again.' };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) redirect(next);

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError || !challenge) return { error: 'Could not check your code. Please try again.' };
  const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
  if (error) return { error: 'That code is not correct. Wait for a new code and try again.' };

  redirect(next);
}
