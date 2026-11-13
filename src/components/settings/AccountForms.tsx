'use client';

import { useActionState } from 'react';
import { changeEmail, changePassword, deleteAccount } from '@/lib/settings-actions';
import { initialFormState } from '@/lib/form-state';
import { FormMessage, PasswordInput, SubmitButton } from '@/components/FormBits';

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(changeEmail, initialFormState);
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={currentEmail} required className="input" />
      </div>
      <SubmitButton pendingText="Sending...">Change email</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePassword, initialFormState);
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <PasswordInput name="current" label="Current password" autoComplete="current-password" />
      <PasswordInput name="password" label="New password" autoComplete="new-password" placeholder="At least 8 characters" />
      <PasswordInput name="confirm" label="Confirm new password" autoComplete="new-password" />
      <SubmitButton pendingText="Updating...">Update password</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, formAction] = useActionState(deleteAccount, initialFormState);
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <PasswordInput name="password" label="Your password" autoComplete="current-password" />
      <div>
        <label htmlFor="delete-confirm" className="label">
          Type DELETE to confirm
        </label>
        <input id="delete-confirm" name="confirm" autoComplete="off" autoCapitalize="characters" required className="input" />
      </div>
      <button type="submit" className="w-full rounded-xl border border-danger/60 px-4 py-3 font-semibold text-danger hover:bg-danger/10">
        Permanently delete my account
      </button>
    </form>
  );
}
