'use client';

import { useActionState } from 'react';
import { updateProfile } from '@/lib/profile-actions';
import { initialFormState } from '@/lib/form-state';
import { FormMessage, SubmitButton } from '@/components/FormBits';

type Values = { full_name: string; username: string; bio: string; location: string };

export function EditProfileForm({ values }: { values: Values }) {
  const [state, formAction] = useActionState(updateProfile, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div>
        <label htmlFor="full_name" className="label">
          Name
        </label>
        <input id="full_name" name="full_name" defaultValue={values.full_name} maxLength={60} required className="input" />
      </div>
      <div>
        <label htmlFor="username" className="label">
          Username
        </label>
        <input
          id="username"
          name="username"
          defaultValue={values.username}
          autoCapitalize="none"
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_]{3,20}"
          required
          className="input"
        />
        <p className="mt-1.5 text-xs text-muted">Lowercase letters, numbers and underscores, 3 to 20 characters.</p>
      </div>
      <div>
        <label htmlFor="bio" className="label">
          Bio
        </label>
        <textarea id="bio" name="bio" defaultValue={values.bio} maxLength={160} rows={3} className="input resize-none" />
        <p className="mt-1.5 text-xs text-muted">Up to 160 characters.</p>
      </div>
      <div>
        <label htmlFor="location" className="label">
          Location <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="location" name="location" defaultValue={values.location} maxLength={60} className="input" />
      </div>
      <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
    </form>
  );
}
