'use client';

import { useActionState } from 'react';
import { savePlaces } from '@/lib/about-actions';
import { VISIBILITY, type Places } from '@/lib/about';
import { initialFormState } from '@/lib/form-state';
import { FormMessage, SubmitButton } from '@/components/FormBits';

export function PlacesForm({ places }: { places: Places | null }) {
  const [state, formAction] = useActionState(savePlaces, initialFormState);
  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <div>
        <label htmlFor="current_city" className="label">
          Lives in
        </label>
        <input id="current_city" name="current_city" defaultValue={places?.current_city ?? ''} maxLength={60} placeholder="City or town" className="input" />
      </div>
      <div>
        <label htmlFor="hometown" className="label">
          From (hometown)
        </label>
        <input id="hometown" name="hometown" defaultValue={places?.hometown ?? ''} maxLength={60} className="input" />
      </div>
      <div>
        <label htmlFor="places_visibility" className="label">
          Who can see this
        </label>
        <select id="places_visibility" name="visibility" defaultValue={places?.visibility ?? 'public'} className="input">
          {VISIBILITY.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pendingText="Saving...">Save places</SubmitButton>
    </form>
  );
}
