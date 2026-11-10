'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset } from '@/lib/auth-actions';
import { initialFormState } from '@/lib/form-state';
import { AuthLayout } from '@/components/AuthLayout';
import { FormMessage, SubmitButton } from '@/components/FormBits';

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordReset, initialFormState);

  return (
    <AuthLayout title="Reset your password" subtitle="We will email you a link to choose a new one.">
      <form action={formAction} className="space-y-4" noValidate>
        <FormMessage state={state} />
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <SubmitButton pendingText="Sending...">Send reset link</SubmitButton>
      </form>
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
