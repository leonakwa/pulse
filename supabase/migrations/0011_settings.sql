-- Pulse phase 11: settings and privacy. Run ONCE in the Supabase SQL editor (after 0010).
-- Every privacy setting is enforced by the database itself, not just hidden in the app:
--   * message_permission: who may start a chat with you and send you messages (everyone / people you follow / nobody)
--   * discoverable: whether you appear in search and suggestions
--   * show_on_leaderboard: whether you appear on the leaderboard
-- Also: account deletion, which removes your account and everything you created.

alter table public.user_settings
  add column message_permission text not null default 'everyone',
  add column discoverable boolean not null default true,
  add column show_on_leaderboard boolean not null default true,
  add constraint user_settings_message_permission_valid check (message_permission in ('everyone', 'following', 'nobody'));

-- Make sure everyone has a settings row.
insert into public.user_settings (user_id) select id from public.profiles on conflict do nothing;

-- Messages: respect the recipient's setting, both when starting a chat and when sending. ----------------------
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not exists (select 1 from public.profiles where id = new.sender_id and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;

  for r in
    select cp.user_id from public.conversation_participants cp
    where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
  loop
    perform 1 from public.user_settings us
    where us.user_id = r.user_id
      and (us.message_permission = 'nobody'
           or (us.message_permission = 'following'
               and not exists (select 1 from public.follows f where f.follower_id = r.user_id and f.following_id = new.sender_id)));
    if found then raise exception 'messages_not_allowed'; end if;
  end loop;

  new.body := btrim(new.body);
  return new;
end;
$$;

create or replace function public.start_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = v_uid then raise exception 'invalid_user'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if not exists (select 1 from public.profiles where id = p_other and status = 'active') then
    raise exception 'user_unavailable';
  end if;

  v_key := least(v_uid::text, p_other::text) || ':' || greatest(v_uid::text, p_other::text);
  select id into v_id from public.conversations where direct_key = v_key;

  if v_id is null then
    if exists (
      select 1 from public.user_settings us
      where us.user_id = p_other
        and (us.message_permission = 'nobody'
             or (us.message_permission = 'following'
                 and not exists (select 1 from public.follows f where f.follower_id = p_other and f.following_id = v_uid)))
    ) then
      raise exception 'messages_not_allowed';
    end if;
    if (select count(*) from public.conversations where created_by = v_uid and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'rate_limited';
    end if;
    insert into public.conversations (direct_key, created_by) values (v_key, v_uid)
      on conflict (direct_key) do nothing returning id into v_id;
    if v_id is null then select id into v_id from public.conversations where direct_key = v_key; end if;
    insert into public.conversation_participants (conversation_id, user_id)
      values (v_id, v_uid), (v_id, p_other) on conflict do nothing;
  end if;

  return v_id;
end;
$$;

-- Search and suggestions: leave out people who switched discoverability off. -----------------------------------
create or replace function public.search_profiles(p_query text, p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, full_name text, bio text, avatar_url text, is_following boolean)
language sql stable security definer set search_path = public, extensions as $$
  with q as (
    select lower(btrim(replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_'))) as t
  )
  select p.id, p.username, p.full_name, p.bio, p.avatar_url,
         exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id) as is_following
  from public.profiles p
  cross join q
  left join public.user_settings us on us.user_id = p.id
  where auth.uid() is not null
    and p.status = 'active'
    and char_length(q.t) >= 2
    and (coalesce(us.discoverable, true) or p.id = auth.uid())
    and (p.username like '%' || q.t || '%' escape '\' or lower(p.full_name) like '%' || q.t || '%' escape '\')
  order by
    (p.username = q.t) desc,
    (p.username like q.t || '%' escape '\') desc,
    (lower(p.full_name) like q.t || '%' escape '\') desc,
    p.username
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0)
$$;

create or replace function public.suggested_accounts(p_limit int default 10)
returns table (id uuid, username text, full_name text, bio text, avatar_url text, follower_count bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.full_name, p.bio, p.avatar_url,
         (select count(*) from public.follows f where f.following_id = p.id) as follower_count
  from public.profiles p
  left join public.user_settings us on us.user_id = p.id
  where auth.uid() is not null
    and p.status = 'active'
    and coalesce(us.discoverable, true)
    and p.id <> auth.uid()
    and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id)
  order by follower_count desc, p.created_at desc
  limit least(greatest(p_limit, 1), 30)
$$;

-- Leaderboard: leave out people who opted out. ---------------------------------------------------------------
create or replace function public.leaderboard_page(p_period text default 'weekly', p_limit int default 25, p_offset int default 0)
returns table (place bigint, user_id uuid, username text, full_name text, avatar_url text, level smallint, level_name text, xp bigint)
language sql stable security definer set search_path = public as $$
  with scores as (
    select p.id, p.username, p.full_name, p.avatar_url, p.level, p.created_at,
           case when p_period = 'all' then p.xp_total else coalesce(w.xp, 0) end as xp
    from public.profiles p
    left join public.user_settings us on us.user_id = p.id
    left join (
      select t.user_id, sum(t.amount) as xp from public.xp_transactions t
      where t.created_at > now() - interval '7 days' group by t.user_id
    ) w on w.user_id = p.id
    where p.status = 'active' and coalesce(us.show_on_leaderboard, true)
  ), ranked as (
    select s.*, rank() over (order by s.xp desc) as rnk from scores s where s.xp > 0
  )
  select r.rnk, r.id, r.username, r.full_name, r.avatar_url, r.level, l.name, r.xp::bigint
  from ranked r left join public.levels l on l.level = r.level
  order by r.rnk, r.created_at, r.id
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

create or replace function public.my_leaderboard_rank(p_period text default 'weekly')
returns table (place bigint, xp bigint)
language sql stable security definer set search_path = public as $$
  with scores as (
    select p.id,
           case when p_period = 'all' then p.xp_total else coalesce(w.xp, 0) end as xp
    from public.profiles p
    left join public.user_settings us on us.user_id = p.id
    left join (
      select t.user_id, sum(t.amount) as xp from public.xp_transactions t
      where t.created_at > now() - interval '7 days' group by t.user_id
    ) w on w.user_id = p.id
    where p.status = 'active' and coalesce(us.show_on_leaderboard, true)
  ), ranked as (
    select s.id, s.xp, rank() over (order by s.xp desc) as rnk from scores s where s.xp > 0
  )
  select r.rnk, r.xp::bigint from ranked r where r.id = auth.uid()
$$;

-- Delete my account: removes the sign-in and (through the database links) your profile, posts, comments, likes,
-- follows, messages you sent, notifications and XP. Photos are removed from public access. Admins are protected.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.admin_users where user_id = v_uid) then raise exception 'admin_cannot_delete'; end if;

  begin
    delete from storage.objects
    where bucket_id in ('avatars', 'covers', 'post-images') and (storage.foldername(name))[1] = v_uid::text;
  exception when others then
    raise warning 'delete_my_account: could not remove image records: %', sqlerrm;
  end;

  delete from auth.users where id = v_uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
