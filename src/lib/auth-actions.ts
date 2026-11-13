'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/form-state';
import { getSiteUrl } from '@/lib/site-url';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '');

function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or fewer.';
  return null;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = text(formData, 'full_name').trim();
  const username = text(formData, 'username').trim().toLowerCase();
  const email = text(formData, 'email').trim().toLowerCase();
  const password = text(formData, 'password');

  if (fullName.length < 1 || fullName.length > 60) return { error: 'Enter your full name (up to 60 characters).' };
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username must be 3 to 20 characters: lowercase letters, numbers and underscores only.' };
  }
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem };

  const supabase = await createClient();

  const { data: available, error: availabilityError } = await supabase.rpc('username_available', {
    p_username: username,
  });
  if (availabilityError) return { error: 'Something went wrong. Please try again.' };
  if (!available) return { error: 'That username is already taken.' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: fullName },
      emailRedirectTo: `${await getSiteUrl()}/auth/callback?next=/feed`,
    },
  });
  if (error) return { error: error.message };

  // Supabase returns an empty identities list when the email is already registered.
  if (data.user?.identities && data.user.identities.length === 0) {
    return { error: 'An account with this email already exists. Try signing in instead.' };
  }

  if (data.session) redirect('/feed');
  return { success: 'Account created. Check your email (and your spam folder) for a confirmation link, then sign in. Did not get it? Use "Resend confirmation email" on the sign-in page.' };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email').trim().toLowerCase();
  const password = text(formData, 'password');
  if (!EMAIL_RE.test(email) || password.length === 0) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { error: 'Confirm your email first. Check your inbox for the link.' };
    }
    return { error: 'Incorrect email or password.' }; // same message for unknown email and wrong password
  }
  redirect('/feed');
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await getSiteUrl()}/auth/callback?next=/reset-password` });

  // Same response either way, so the form cannot be used to find registered emails.
  return { success: 'If an account exists for that email, a reset link is on its way.' };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = text(formData, 'password');
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem };
  if (password !== text(formData, 'confirm')) return { error: 'Passwords do not match.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link has expired. Request a new one.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect('/feed');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// For people who never received (or lost) their confirmation email.
export async function resendConfirmation(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, 'email').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${await getSiteUrl()}/auth/callback?next=/feed` },
  });
  if (error && /rate|limit|seconds|too many/i.test(error.message)) {
    return { error: 'Too many emails were requested. Please wait a few minutes and try again.' };
  }

  // Same message either way, so this cannot be used to find out who has an account.
  return { success: 'If that address has an account waiting for confirmation, we sent a new link. Check your inbox and spam folder.' };
}
