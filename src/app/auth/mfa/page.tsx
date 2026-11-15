'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState } from 'react';
import { verifyMfaLogin } from '@/lib/mfa-actions';
import { signOut } from '@/lib/auth-actions';
import { initialFormState } from '@/lib/form-state';
import { AuthLayout } from '@/components/AuthLayout';
import { FormMessage, SubmitButton } from '@/components/FormBits';

function MfaForm() {
  const [state, formAction] = useActionState(verifyMfaLogin, initialFormState);
  const next = useSearchParams().get('next') ?? '/feed';

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="code" className="label">
          6-digit code
        </label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="input text-center text-xl tracking-widest" />
      </div>
      <SubmitButton pendingText="Checking...">Continue</SubmitButton>
    </form>
  );
}

export default function MfaPage() {
  return (
    <AuthLayout title="Two-step login" subtitle="Open your authenticator app and enter the current code for PulseHive.">
      <Suspense>
        <MfaForm />
      </Suspense>
      <form action={signOut} className="mt-8 text-center">
        <button className="text-sm font-semibold text-brand">Cancel and sign out</button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        <Link href="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
