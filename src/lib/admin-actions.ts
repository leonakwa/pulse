'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['active', 'suspended', 'deactivated'];
const RETURN_RE = /^\/admin(\/[A-Za-z0-9-]+)*$/;

function friendly(message?: string): string {
  const m = message ?? '';
  if (m.includes('cannot_change_self')) return 'You cannot change your own account.';
  if (m.includes('cannot_change_admin')) return 'Admin accounts are protected.';
  if (m.includes('reason_required')) return 'Please give a reason (at least 3 characters).';
  if (m.includes('post_not_found')) return 'That post no longer exists.';
  if (m.includes('user_not_found')) return 'That user no longer exists.';
  if (m.includes('not_admin')) return 'Not allowed.';
  return 'Something went wrong. Please try again.';
}

export async function setUserStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const status = String(formData.get('status') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300);
  if (!UUID_RE.test(userId) || !STATUSES.includes(status)) redirect('/admin/users');

  const { error } = await supabase.rpc('admin_set_user_status', { p_user: userId, p_status: status, p_reason: reason });
  revalidatePath('/admin', 'layout');
  redirect(`/admin/users/${userId}?${error ? `error=${encodeURIComponent(friendly(error.message))}` : 'done=status'}`);
}

export async function deletePostAsAdmin(formData: FormData) {
  const { supabase } = await requireAdmin();
  const postId = String(formData.get('postId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 300);
  const requested = String(formData.get('returnTo') ?? '');
  const returnTo = RETURN_RE.test(requested) ? requested : '/admin/posts';
  if (!UUID_RE.test(postId)) redirect(returnTo);

  const { error } = await supabase.rpc('admin_delete_post', { p_post: postId, p_reason: reason });
  revalidatePath('/', 'layout');
  redirect(`${returnTo}?${error ? `error=${encodeURIComponent(friendly(error.message))}` : 'done=post'}`);
}
