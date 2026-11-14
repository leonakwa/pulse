'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState } from 'react';
import { signIn } from '@/lib/auth-actions';
import { initialFormState } from '@/lib/form-state';
import { AuthLayout } from '@/components/AuthLayout';
import { FormMessage, PasswordInput, SubmitButton } from '@/components/FormBits';

function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialFormState);
  const params = useSearchParams();
  const linkError = params.get('error') === 'link';
  const deleted = params.get('deleted') === '1';

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {linkError && !state.error ? <FormMessage state={{ error: 'That link is invalid or has expired. Try again.' }} /> : null}
      {deleted ? <FormMessage state={{ success: 'Your account has been deleted.' }} /> : null}
      <FormMessage state={state} />
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <PasswordInput name="password" label="Password" autoComplete="current-password" />
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-brand">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to see what is new.">
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted">
        New to PulseHive?{' '}
        <Link href="/register" className="font-semibold text-brand">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        Did not get your confirmation email?{' '}
        <Link href="/auth/resend" className="font-semibold text-brand">
          Resend it
        </Link>
      </p>
    </AuthLayout>
  );
}
