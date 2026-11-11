'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { IMAGE_KINDS, type ImageKind } from '@/lib/image-config';

type Result = { error?: string; url?: string | null };

// <user id>/<file name>, nothing else.
const PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/i;

function pathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

// Called AFTER the browser has uploaded the file. The profile is only updated if the image
// really exists in storage; if anything fails, the uploaded file is deleted again.
export async function saveProfileImage(kind: ImageKind, path: string): Promise<Result> {
  const cfg = IMAGE_KINDS[kind];
  if (!cfg) return { error: 'Invalid image type.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  // Users can only attach files from their own folder.
  if (typeof path !== 'string' || !PATH_RE.test(path) || !path.startsWith(`${user.id}/`)) {
    return { error: 'Invalid image.' };
  }

  const fileName = path.slice(user.id.length + 1);
  const { data: listed, error: listError } = await supabase.storage
    .from(cfg.bucket)
    .list(user.id, { search: fileName, limit: 1 });
  if (listError || !listed?.some((f) => f.name === fileName)) {
    return { error: 'The image was not uploaded. Please try again.' };
  }

  const { data: current } = await supabase.from('profiles').select('avatar_url, cover_url').eq('id', user.id).maybeSingle();
  const oldUrl: string | null = current ? current[cfg.column] : null;

  const publicUrl = supabase.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ [cfg.column]: publicUrl })
    .eq('id', user.id);

  if (updateError) {
    await supabase.storage.from(cfg.bucket).remove([path]); // roll back: no orphan file
    return { error: 'Could not save your image. Please try again.' };
  }

  // Tidy up the previous image (best effort).
  const oldPath = pathFromPublicUrl(oldUrl, cfg.bucket);
  if (oldPath && oldPath.startsWith(`${user.id}/`) && oldPath !== path) {
    await supabase.storage.from(cfg.bucket).remove([oldPath]);
  }

  revalidatePath('/', 'layout');
  return { url: publicUrl };
}

export async function removeProfileImage(kind: ImageKind): Promise<Result> {
  const cfg = IMAGE_KINDS[kind];
  if (!cfg) return { error: 'Invalid image type.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const { data: current } = await supabase.from('profiles').select('avatar_url, cover_url').eq('id', user.id).maybeSingle();
  const oldUrl: string | null = current ? current[cfg.column] : null;

  const { error } = await supabase
    .from('profiles')
    .update({ [cfg.column]: null })
    .eq('id', user.id);
  if (error) return { error: 'Could not remove the image. Please try again.' };

  const oldPath = pathFromPublicUrl(oldUrl, cfg.bucket);
  if (oldPath && oldPath.startsWith(`${user.id}/`)) {
    await supabase.storage.from(cfg.bucket).remove([oldPath]);
  }

  revalidatePath('/', 'layout');
  return { url: null };
}
