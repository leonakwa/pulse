'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { resendConfirmation } from '@/lib/auth-actions';
import { initialFormState } from '@/lib/form-state';
import { AuthLayout } from '@/components/AuthLayout';
import { FormMessage, SubmitButton } from '@/components/FormBits';

export default function ResendConfirmationPage() {
  const [state, formAction] = useActionState(resendConfirmation, initialFormState);

  return (
    <AuthLayout title="Resend confirmation email" subtitle="Enter the email you signed up with and we will send a new link.">
      <form action={formAction} className="space-y-4" noValidate>
        <FormMessage state={state} />
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <SubmitButton pendingText="Sending...">Send a new link</SubmitButton>
        <p className="text-xs text-muted">Check your spam or junk folder too. The email can take a few minutes to arrive.</p>
      </form>
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
