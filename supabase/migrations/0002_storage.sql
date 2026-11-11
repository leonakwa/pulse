-- Pulse phase 3: image storage.
-- Run in the Supabase SQL editor. Safe to run more than once.
-- Buckets are public for reading (images load by URL) but upload/delete is limited to
-- your own folder: every file path starts with your user id.
-- Size and type limits are enforced by Supabase itself, not just the app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('covers', 'covers', true, 4194304, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pulse_images_insert_own on storage.objects;
drop policy if exists pulse_images_select_own on storage.objects;
drop policy if exists pulse_images_delete_own on storage.objects;

create policy pulse_images_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'covers', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- select is needed so uploads, existence checks and deletes work for your own files.
create policy pulse_images_select_own on storage.objects for select to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy pulse_images_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
