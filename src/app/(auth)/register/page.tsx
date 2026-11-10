'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signUp } from '@/lib/auth-actions';
import { initialFormState } from '@/lib/form-state';
import { AuthLayout } from '@/components/AuthLayout';
import { FormMessage, PasswordInput, SubmitButton } from '@/components/FormBits';

export default function RegisterPage() {
  const [state, formAction] = useActionState(signUp, initialFormState);

  return (
    <AuthLayout title="Create your account" subtitle="Join Pulse and start earning XP.">
      <form action={formAction} className="space-y-4" noValidate>
        <FormMessage state={state} />
        <div>
          <label htmlFor="full_name" className="label">
            Full name
          </label>
          <input id="full_name" name="full_name" autoComplete="name" maxLength={60} required className="input" />
        </div>
        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            minLength={3}
            maxLength={20}
            pattern="[a-z0-9_]{3,20}"
            placeholder="letters, numbers, underscores"
            required
            className="input"
          />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <PasswordInput name="password" label="Password" autoComplete="new-password" placeholder="At least 8 characters" />
        <SubmitButton pendingText="Creating account...">Create account</SubmitButton>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
