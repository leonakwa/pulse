import type { SupabaseClient } from '@supabase/supabase-js';

export const EDUCATION_KINDS = [
  { value: 'primary', label: 'Primary school' },
  { value: 'secondary', label: 'Secondary school' },
  { value: 'college', label: 'College' },
  { value: 'university', label: 'University' },
  { value: 'other', label: 'Other' },
] as const;

export const VISIBILITY = [
  { value: 'public', label: 'Public (other members can see it)' },
  { value: 'only_me', label: 'Only me' },
] as const;

export type EducationItem = {
  id: string;
  school_name: string;
  kind: string;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
  description: string | null;
  visibility: string;
};

export type WorkItem = {
  id: string;
  company: string;
  position: string | null;
  location: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
  description: string | null;
  visibility: string;
};

export type Places = { current_city: string | null; hometown: string | null; visibility: string };
export type About = { education: EducationItem[]; work: WorkItem[]; places: Places | null };

export const kindLabel = (value: string) => EDUCATION_KINDS.find((k) => k.value === value)?.label ?? value;

export function yearsLabel(start: number | null, end: number | null, current: boolean): string {
  if (current) return start ? `${start} – Present` : 'Present';
  if (start && end) return start === end ? `${start}` : `${start} – ${end}`;
  return start || end ? String(start ?? end) : '';
}

// The database only returns what you are allowed to see: your own items, and other people's Public ones.
export async function getAbout(supabase: SupabaseClient, userId: string): Promise<About> {
  const [education, work, places] = await Promise.all([
    supabase
      .from('profile_education')
      .select('id, school_name, kind, field_of_study, start_year, end_year, is_current, description, visibility')
      .eq('user_id', userId)
      .order('start_year', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('profile_work')
      .select('id, company, position, location, start_year, end_year, is_current, description, visibility')
      .eq('user_id', userId)
      .order('start_year', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase.from('profile_places').select('current_city, hometown, visibility').eq('user_id', userId).maybeSingle(),
  ]);
  return {
    education: (education.data ?? []) as unknown as EducationItem[],
    work: (work.data ?? []) as unknown as WorkItem[],
    places: (places.data ?? null) as unknown as Places | null,
  };
}
