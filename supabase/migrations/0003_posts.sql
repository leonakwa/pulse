-- Pulse phase 4: posts and images. Run ONCE in the Supabase SQL editor.
-- Security: clients cannot insert posts directly. They call create_post(), which checks everything
-- and saves the post and its images in ONE transaction (no half-saved posts), verifies each image
-- really exists in storage, and rate-limits spam.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint posts_body_length check (char_length(body) <= 500)
);
create index posts_created_idx on public.posts (created_at desc, id desc);
create index posts_author_created_idx on public.posts (author_id, created_at desc, id desc);

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint post_images_position_range check (position between 0 and 3),
  constraint post_images_unique_position unique (post_id, position),
  constraint post_images_unique_path unique (storage_path)
);
create index post_images_post_idx on public.post_images (post_id);

alter table public.posts enable row level security;
alter table public.post_images enable row level security;

revoke all on public.posts, public.post_images from anon;
revoke insert, update on public.posts from authenticated;
grant update (body) on public.posts to authenticated;          -- only the text can be edited
revoke insert, update, delete on public.post_images from authenticated;

create policy posts_select on public.posts for select to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = posts.author_id and p.status = 'active')
  );
create policy posts_update_own on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete_own on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());
create policy post_images_select on public.post_images for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_images.post_id));

-- Edits: trim the text, stamp edited_at, and never allow a post with no text and no images.
create or replace function public.posts_before_update()
returns trigger language plpgsql as $$
begin
  new.body := trim(new.body);
  if new.body = '' and not exists (select 1 from public.post_images where post_id = new.id) then
    raise exception 'empty_post';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger posts_before_update before update on public.posts
  for each row execute function public.posts_before_update();

create or replace function public.create_post(p_body text, p_image_paths text[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_paths text[] := coalesce(p_image_paths, '{}');
  v_count int := coalesce(array_length(coalesce(p_image_paths, '{}'), 1), 0);
  v_post_id uuid;
  v_path text;
  v_pos smallint := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if char_length(v_body) > 500 then raise exception 'body_too_long'; end if;
  if v_body = '' and v_count = 0 then raise exception 'empty_post'; end if;
  if v_count > 4 then raise exception 'too_many_images'; end if;
  if (select count(*) from public.posts where author_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
  end if;
  if (select count(distinct x) from unnest(v_paths) as x) <> v_count then raise exception 'image_missing'; end if;

  -- Every image must be in the user's own folder and really exist in storage.
  foreach v_path in array v_paths loop
    if v_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
       or split_part(v_path, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects where bucket_id = 'post-images' and name = v_path) then
      raise exception 'image_missing';
    end if;
  end loop;

  insert into public.posts (author_id, body) values (v_uid, v_body) returning id into v_post_id;

  foreach v_path in array v_paths loop
    insert into public.post_images (post_id, storage_path, position) values (v_post_id, v_path, v_pos);
    v_pos := v_pos + 1;
  end loop;

  return v_post_id;
end;
$$;

revoke all on function public.create_post(text, text[]) from public;
grant execute on function public.create_post(text, text[]) to authenticated;
