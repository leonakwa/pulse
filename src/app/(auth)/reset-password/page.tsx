'use client';

import { useActionState } from 'react';
import { updatePassword } from '@/lib/auth-actions';
import { initialFormState } from '@/lib/form-state';
import { AuthLayout } from '@/components/AuthLayout';
import { FormMessage, PasswordInput, SubmitButton } from '@/components/FormBits';

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(updatePassword, initialFormState);

  return (
    <AuthLayout title="Choose a new password">
      <form action={formAction} className="space-y-4" noValidate>
        <FormMessage state={state} />
        <PasswordInput name="password" label="New password" autoComplete="new-password" placeholder="At least 8 characters" />
        <PasswordInput name="confirm" label="Confirm new password" autoComplete="new-password" />
        <SubmitButton pendingText="Saving...">Update password</SubmitButton>
      </form>
    </AuthLayout>
  );
}
