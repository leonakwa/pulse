'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/form-state';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? '');

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = text(formData, 'full_name').trim();
  const username = text(formData, 'username').trim().toLowerCase();
  const bio = text(formData, 'bio').trim();
  const location = text(formData, 'location').trim();

  if (fullName.length < 1 || fullName.length > 60) return { error: 'Enter your name (up to 60 characters).' };
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username must be 3 to 20 characters: lowercase letters, numbers and underscores only.' };
  }
  if (bio.length > 160) return { error: 'Bio must be 160 characters or fewer.' };
  if (location.length > 60) return { error: 'Location must be 60 characters or fewer.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  // Row Level Security restricts this to the signed-in user's own row and to these columns only.
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, username, bio: bio || null, location: location || null })
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') return { error: 'That username is already taken.' };
    return { error: 'Could not save your changes. Please try again.' };
  }

  revalidatePath('/', 'layout');
  redirect(`/u/${username}`);
}
