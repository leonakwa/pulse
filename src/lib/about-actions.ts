'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/form-state';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['primary', 'secondary', 'college', 'university', 'other'];
const VISIBILITIES = ['public', 'only_me'];

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const orNull = (value: string) => (value === '' ? null : value);

// Returns a number, null (left blank), or 'invalid'.
function year(fd: FormData, key: string): number | null | 'invalid' {
  const v = text(fd, key);
  if (v === '') return null;
  if (!/^\d{4}$/.test(v)) return 'invalid';
  const n = Number(v);
  return n >= 1900 && n <= 2100 ? n : 'invalid';
}

function friendly(error: { code?: string; message?: string } | null): string {
  if (error?.message?.includes('too_many_items')) return 'You can add up to 10 of these. Remove one first.';
  if (error?.code === '23514') return 'Please check the text lengths and years.';
  // Temporary while we test: include the real reason so a failing save can be diagnosed.
  console.error('about save failed:', error?.code, error?.message);
  return `Could not save. Please try again. (${error?.message ?? 'unknown error'})`;
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Years shared by education and work
function readYears(fd: FormData): { start: number | null; end: number | null; current: boolean } | string {
  const start = year(fd, 'start_year');
  const end = year(fd, 'end_year');
  if (start === 'invalid' || end === 'invalid') return 'Enter years as 4 digits, like 2016.';
  const current = fd.get('is_current') === 'on';
  if (!current && start && end && end < start) return 'The end year cannot be before the start year.';
  return { start, end: current ? null : end, current };
}

export async function saveEducation(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, 'id');
  const school = text(fd, 'school_name');
  const kind = text(fd, 'kind');
  const field = text(fd, 'field_of_study');
  const description = text(fd, 'description');
  const visibility = text(fd, 'visibility');

  if (school.length < 1 || school.length > 100) return { error: 'Enter the name of the school (up to 100 characters).' };
  if (!KINDS.includes(kind)) return { error: 'Choose the type of school.' };
  if (field.length > 100) return { error: 'Field of study can be up to 100 characters.' };
  if (description.length > 300) return { error: 'The description can be up to 300 characters.' };
  if (!VISIBILITIES.includes(visibility)) return { error: 'Choose who can see this.' };
  const years = readYears(fd);
  if (typeof years === 'string') return { error: years };
  if (id && !UUID_RE.test(id)) return { error: 'Invalid item.' };

  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const row = {
    school_name: school,
    kind,
    field_of_study: orNull(field),
    start_year: years.start,
    end_year: years.end,
    is_current: years.current,
    description: orNull(description),
    visibility,
  };

  const { error } = id
    ? await supabase.from('profile_education').update(row).eq('id', id).eq('user_id', user.id)
    : await supabase.from('profile_education').insert({ ...row, user_id: user.id });
  if (error) return { error: friendly(error) };

  revalidatePath('/', 'layout');
  return { success: 'Saved.' };
}

export async function saveWork(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, 'id');
  const company = text(fd, 'company');
  const position = text(fd, 'position');
  const location = text(fd, 'location');
  const description = text(fd, 'description');
  const visibility = text(fd, 'visibility');

  if (company.length < 1 || company.length > 100) return { error: 'Enter the company or place of work (up to 100 characters).' };
  if (position.length > 100) return { error: 'Position can be up to 100 characters.' };
  if (location.length > 100) return { error: 'Location can be up to 100 characters.' };
  if (description.length > 300) return { error: 'The description can be up to 300 characters.' };
  if (!VISIBILITIES.includes(visibility)) return { error: 'Choose who can see this.' };
  const years = readYears(fd);
  if (typeof years === 'string') return { error: years };
  if (id && !UUID_RE.test(id)) return { error: 'Invalid item.' };

  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const row = {
    company,
    position: orNull(position),
    location: orNull(location),
    start_year: years.start,
    end_year: years.end,
    is_current: years.current,
    description: orNull(description),
    visibility,
  };

  const { error } = id
    ? await supabase.from('profile_work').update(row).eq('id', id).eq('user_id', user.id)
    : await supabase.from('profile_work').insert({ ...row, user_id: user.id });
  if (error) return { error: friendly(error) };

  revalidatePath('/', 'layout');
  return { success: 'Saved.' };
}

export async function deleteAboutItem(kind: 'education' | 'work', id: string): Promise<{ error?: string }> {
  if (!UUID_RE.test(id) || (kind !== 'education' && kind !== 'work')) return { error: 'Invalid item.' };
  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const table = kind === 'education' ? 'profile_education' : 'profile_work';
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id);
  if (error) return { error: 'Could not delete. Please try again.' };

  revalidatePath('/', 'layout');
  return {};
}

export async function savePlaces(_prev: FormState, fd: FormData): Promise<FormState> {
  const city = text(fd, 'current_city');
  const home = text(fd, 'hometown');
  const visibility = text(fd, 'visibility');
  if (city.length > 60 || home.length > 60) return { error: 'Places can be up to 60 characters.' };
  if (!VISIBILITIES.includes(visibility)) return { error: 'Choose who can see this.' };

  const { supabase, user } = await currentUser();
  if (!user) return { error: 'Please sign in again.' };

  const { error } = await supabase
    .from('profile_places')
    .upsert({ user_id: user.id, current_city: orNull(city), hometown: orNull(home), visibility }, { onConflict: 'user_id' });
  if (error) return { error: friendly(error) };

  revalidatePath('/', 'layout');
  return { success: 'Saved.' };
}
