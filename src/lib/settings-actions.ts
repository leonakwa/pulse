'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/form-state';

const BOOLEAN_KEYS = [
  'notify_follows', 'notify_likes', 'notify_comments', 'notify_shares', 'notify_messages',
  'discoverable', 'show_on_leaderboard',
];
const THEMES = ['light', 'dark', 'system'];
const MESSAGE_PERMISSIONS = ['everyone', 'following', 'nobody'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const text = (formData: FormData, key: string) => String(formData.get(key) ?? '');

// One setting at a time, from a fixed allow-list. Row Level Security limits this to your own settings row.
export async function updateSetting(key: string, value: string | boolean): Promise<{ error?: string }> {
  let patch: Record<string, string | boolean>;
  if (BOOLEAN_KEYS.includes(key) && typeof value === 'boolean') patch = { [key]: value };
  else if (key === 'theme' && typeof value === 'string' && THEMES.includes(value)) patch = { theme: value };
  else if (key === 'message_permission' && typeof value === 'string' && MESSAGE_PERMISSIONS.includes(value)) patch = { message_permission: value };
  else return { error: 'Invalid setting.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data, error } = await supabase.from('user_settings').update(patch).eq('user_id', user.id).select('user_id');
  if (error || !data || data.length === 0) return { error: 'Could not save your setting. Please try again.' };

  revalidatePath('/', 'layout');
  return {};
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = text(formData, 'current');
  const next = text(formData, 'password');
  const confirm = text(formData, 'confirm');

  if (next.length < 8) return { error: 'New password must be at least 8 characters.' };
  if (next.length > 72) return { error: 'New password must be 72 characters or fewer.' };
  if (next !== confirm) return { error: 'The new passwords do not match.' };
  if (next === current) return { error: 'Choose a password different from your current one.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Please sign in again.' };

  // Confirm it is really you before changing the password.
  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (authError) return { error: 'Your current password is not correct.' };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return { success: 'Password updated.' };
}

export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };
  if (email === user.email?.toLowerCase()) return { error: 'That is already your email address.' };

  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${siteUrl()}/auth/callback?next=/settings/account` });
  if (error) return { error: error.message };
  return { success: 'Check your inbox: we sent a confirmation link. Your email changes once you confirm it (you may need to confirm from your old address too).' };
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  if (text(formData, 'confirm').trim() !== 'DELETE') return { error: 'Type DELETE (in capitals) to confirm.' };
  const password = text(formData, 'password');
  if (!password) return { error: 'Enter your password to confirm.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Please sign in again.' };

  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (authError) return { error: 'Your password is not correct.' };

  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    return { error: error.message.includes('admin_cannot_delete') ? 'Admin accounts cannot be deleted from here.' : 'Could not delete your account. Please try again.' };
  }

  await supabase.auth.signOut();
  redirect('/login?deleted=1');
}
