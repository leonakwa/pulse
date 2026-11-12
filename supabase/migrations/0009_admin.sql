-- Pulse admin dashboard. Run ONCE in the Supabase SQL editor (after 0008).
-- SECURITY: every admin_* function checks, inside the database, that the caller is listed in admin_users.
-- A normal user calling them (even by hacking the app) just gets an error. Passwords and password hashes are
-- never read, returned or logged. Admins are added ONLY by running SQL (see the bottom), never from the app.

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  target_post_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  constraint admin_actions_action_valid check (action in ('suspend_user', 'deactivate_user', 'reactivate_user', 'delete_post'))
);
create index admin_actions_created_idx on public.admin_actions (created_at desc, id desc);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;     -- only the functions below can touch it

create index if not exists post_comments_created_idx on public.post_comments (created_at);
create index if not exists post_likes_created_idx on public.post_likes (created_at);

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

-- Platform numbers (counts only: no message contents are ever shown).
create or replace function public.admin_overview()
returns table (
  total_users bigint, new_users_24h bigint, new_users_7d bigint, active_users_7d bigint, suspended_users bigint,
  total_posts bigint, posts_24h bigint, total_comments bigint, total_likes bigint, total_follows bigint,
  total_conversations bigint, total_messages bigint, total_xp bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles x where x.created_at > now() - interval '24 hours'),
    (select count(*) from public.profiles x where x.created_at > now() - interval '7 days'),
    (select count(*) from public.user_streaks s where s.last_active_day >= (now() at time zone 'utc')::date - 6),
    (select count(*) from public.profiles x where x.status <> 'active'),
    (select count(*) from public.posts),
    (select count(*) from public.posts x where x.created_at > now() - interval '24 hours'),
    (select count(*) from public.post_comments),
    (select count(*) from public.post_likes),
    (select count(*) from public.follows),
    (select count(*) from public.conversations),
    (select count(*) from public.messages),
    (select coalesce(sum(x.xp_total), 0)::bigint from public.profiles x);
end;
$$;

-- New users / posts / comments / likes per day (UTC), newest first.
create or replace function public.admin_daily_stats(p_days int default 14)
returns table (stat_day date, new_users bigint, new_posts bigint, new_comments bigint, new_likes bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_days int := least(greatest(coalesce(p_days, 14), 1), 60);
begin
  perform public.assert_admin();
  return query
  select g.d::date,
    (select count(*) from public.profiles x where x.created_at >= (g.d at time zone 'utc') and x.created_at < (g.d at time zone 'utc') + interval '1 day'),
    (select count(*) from public.posts x where x.created_at >= (g.d at time zone 'utc') and x.created_at < (g.d at time zone 'utc') + interval '1 day'),
    (select count(*) from public.post_comments x where x.created_at >= (g.d at time zone 'utc') and x.created_at < (g.d at time zone 'utc') + interval '1 day'),
    (select count(*) from public.post_likes x where x.created_at >= (g.d at time zone 'utc') and x.created_at < (g.d at time zone 'utc') + interval '1 day')
  from generate_series(
    ((now() at time zone 'utc')::date - (v_days - 1))::timestamp,
    (now() at time zone 'utc')::date::timestamp,
    interval '1 day'
  ) as g(d)
  order by g.d desc;
end;
$$;

create or replace function public.admin_list_users(p_query text default '', p_status text default 'all', p_limit int default 25, p_offset int default 0)
returns table (
  id uuid, username text, full_name text, email text, status text, level smallint, xp_total bigint,
  post_count bigint, follower_count bigint, created_at timestamptz, last_sign_in_at timestamptz,
  email_confirmed boolean, is_admin boolean
)
language plpgsql stable security definer set search_path = public, auth as $$
declare v_q text := lower(btrim(coalesce(p_query, '')));
begin
  perform public.assert_admin();
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  select p.id, p.username, p.full_name, u.email::text, p.status, p.level, p.xp_total,
         (select count(*) from public.posts x where x.author_id = p.id),
         (select count(*) from public.follows f where f.following_id = p.id),
         p.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
         exists (select 1 from public.admin_users a where a.user_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  where (p_status = 'all' or p.status = p_status)
    and (v_q = ''
         or p.username like '%' || v_q || '%' escape '\'
         or lower(p.full_name) like '%' || v_q || '%' escape '\'
         or lower(u.email::text) like '%' || v_q || '%' escape '\')
  order by p.created_at desc, p.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_get_user(p_user uuid)
returns table (
  id uuid, username text, full_name text, bio text, location text, email text, status text, level smallint,
  xp_total bigint, post_count bigint, follower_count bigint, following_count bigint, created_at timestamptz,
  last_sign_in_at timestamptz, email_confirmed boolean, is_admin boolean
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.assert_admin();
  return query
  select p.id, p.username, p.full_name, p.bio, p.location, u.email::text, p.status, p.level, p.xp_total,
         (select count(*) from public.posts x where x.author_id = p.id),
         (select count(*) from public.follows f where f.following_id = p.id),
         (select count(*) from public.follows f where f.follower_id = p.id),
         p.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
         exists (select 1 from public.admin_users a where a.user_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user;
end;
$$;

-- Latest sign-in per user (login activity).
create or replace function public.admin_recent_logins(p_limit int default 25)
returns table (user_id uuid, username text, full_name text, email text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.assert_admin();
  return query
  select u.id, p.username, p.full_name, u.email::text, u.last_sign_in_at
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.last_sign_in_at is not null
  order by u.last_sign_in_at desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.admin_recent_posts(p_limit int default 20, p_offset int default 0, p_author uuid default null)
returns table (
  id uuid, author_id uuid, username text, full_name text, body text, like_count integer, comment_count integer,
  created_at timestamptz, image_paths text[]
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select p.id, p.author_id, pr.username, pr.full_name, p.body, p.like_count, p.comment_count, p.created_at,
         coalesce((select array_agg(i.storage_path order by i.position) from public.post_images i where i.post_id = p.id), '{}'::text[])
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p_author is null or p.author_id = p_author
  order by p.created_at desc, p.id desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_audit_log(p_limit int default 30)
returns table (id uuid, created_at timestamptz, action text, reason text, admin_username text, target_username text, target_user_id uuid, target_post_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select a.id, a.created_at, a.action, a.reason, adm.username, tgt.username, a.target_user_id, a.target_post_id
  from public.admin_actions a
  left join public.profiles adm on adm.id = a.admin_id
  left join public.profiles tgt on tgt.id = a.target_user_id
  order by a.created_at desc, a.id desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

-- Suspend / deactivate / reactivate. Blocks sign-in as well as using the app. Admins cannot be touched.
create or replace function public.admin_set_user_status(p_user uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.assert_admin();
  if p_status not in ('active', 'suspended', 'deactivated') then raise exception 'invalid_status'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user) then raise exception 'cannot_change_admin'; end if;
  if p_status <> 'active' and char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user_not_found'; end if;

  update public.profiles set status = p_status where id = p_user;

  begin   -- also stop them signing in (best effort; the app and database rules already block them)
    update auth.users
    set banned_until = case when p_status = 'active' then null else now() + interval '100 years' end
    where id = p_user;
  exception when others then
    raise warning 'admin_set_user_status: could not update banned_until: %', sqlerrm;
  end;

  insert into public.admin_actions (admin_id, action, target_user_id, reason)
  values (
    auth.uid(),
    case p_status when 'active' then 'reactivate_user' when 'suspended' then 'suspend_user' else 'deactivate_user' end,
    p_user,
    nullif(btrim(coalesce(p_reason, '')), '')
  );
end;
$$;

-- Remove a post (and its likes, comments and notifications) with a recorded reason.
create or replace function public.admin_delete_post(p_post uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_paths text[];
begin
  perform public.assert_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  select author_id into v_author from public.posts where id = p_post;
  if not found then raise exception 'post_not_found'; end if;

  select array_agg(storage_path) into v_paths from public.post_images where post_id = p_post;
  delete from public.posts where id = p_post;

  begin   -- stop serving the photos (the stored file may remain until storage is cleaned up)
    if v_paths is not null then
      delete from storage.objects where bucket_id = 'post-images' and name = any (v_paths);
    end if;
  exception when others then
    raise warning 'admin_delete_post: could not remove image records: %', sqlerrm;
  end;

  insert into public.admin_actions (admin_id, action, target_user_id, target_post_id, reason)
  values (auth.uid(), 'delete_post', v_author, p_post, btrim(p_reason));
end;
$$;

revoke all on function public.assert_admin(), public.admin_overview(), public.admin_daily_stats(int),
  public.admin_list_users(text, text, int, int), public.admin_get_user(uuid), public.admin_recent_logins(int),
  public.admin_recent_posts(int, int, uuid), public.admin_audit_log(int),
  public.admin_set_user_status(uuid, text, text), public.admin_delete_post(uuid, text) from public, anon;
revoke all on function public.assert_admin() from authenticated;
grant execute on function public.admin_overview(), public.admin_daily_stats(int),
  public.admin_list_users(text, text, int, int), public.admin_get_user(uuid), public.admin_recent_logins(int),
  public.admin_recent_posts(int, int, uuid), public.admin_audit_log(int),
  public.admin_set_user_status(uuid, text, text), public.admin_delete_post(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- MAKE YOURSELF AN ADMIN (run this separately, once, after the above succeeds).
-- Change 'ak_leon' to your own username if it is different:
--
--   insert into public.admin_users (user_id, role)
--   select id, 'admin' from public.profiles where username = 'ak_leon'
--   on conflict (user_id) do nothing;
