'use server';

import { createClient } from '@/lib/supabase/server';
import { REPORT_REASONS } from '@/lib/reports';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ['post', 'comment', 'user'];

function friendly(message?: string): string {
  const m = message ?? '';
  if (m.includes('already_reported')) return 'You already reported this. Thank you, we are looking at it.';
  if (m.includes('own_content')) return 'You cannot report your own content.';
  if (m.includes('target_not_found')) return 'This is no longer available.';
  if (m.includes('rate_limited')) return 'You are sending reports too fast. Please wait a little.';
  if (m.includes('details_too_long')) return 'Please keep the details under 300 characters.';
  return 'Something went wrong. Please try again.';
}

export async function reportContent(type: string, targetId: string, reason: string, details: string): Promise<{ error?: string }> {
  if (!TYPES.includes(type) || !UUID_RE.test(targetId)) return { error: 'Invalid report.' };
  if (!REPORT_REASONS.some((r) => r.value === reason)) return { error: 'Please choose a reason.' };
  const text = String(details ?? '').trim();
  if (text.length > 300) return { error: 'Please keep the details under 300 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { error } = await supabase.rpc('report_content', { p_type: type, p_target: targetId, p_reason: reason, p_details: text });
  if (error) return { error: friendly(error.message) };
  return {};
}
