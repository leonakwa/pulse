import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Every admin page and every admin action starts with this. Anyone who is not an admin gets a plain "not found",
// so the admin area does not even reveal that it exists. The database repeats the check inside every admin function.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) notFound();

  return { supabase, user };
}

export const num = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString('en');

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return `${new Date(iso).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'UTC' });
}
