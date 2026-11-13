-- Pulse phase 10: sharing. Run ONCE in the Supabase SQL editor (after 0009).
-- A share is a post that points back to the original (shared_post_id), so it can always be traced to the
-- original author. You can share any post once, not your own, and sharing a share shares the ORIGINAL.
-- If the original is deleted, the share stays but shows "This post is no longer available".

alter table public.posts
  add column is_share boolean not null default false,
  add column shared_post_id uuid references public.posts (id) on delete set null,
  add column share_count integer not null default 0,
  add constraint posts_share_count_nonnegative check (share_count >= 0),
  add constraint posts_share_not_self check (shared_post_id is null or shared_post_id <> id),
  add constraint posts_share_shape check (is_share or shared_post_id is null);

create unique index posts_one_share_per_user on public.posts (author_id, shared_post_id)
  where is_share and shared_post_id is not null;
create index posts_shared_post_idx on public.posts (shared_post_id) where shared_post_id is not null;

alter table public.user_settings add column notify_shares boolean not null default true;

-- A share may have an empty comment; normal posts still need text or a photo.
create or replace function public.posts_before_update()
returns trigger language plpgsql as $$
begin
  if new.body is not distinct from old.body then
    return new;
  end if;
  new.body := trim(new.body);
  if new.body = '' and not new.is_share and not exists (select 1 from public.post_images where post_id = new.id) then
    raise exception 'empty_post';
  end if;
  new.edited_at := now();
  new.updated_at := now();
  return new;
end;
$$;

-- Share counter (kept by the database, so it cannot be faked).
create or replace function public.bump_share_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.is_share and new.shared_post_id is not null then
      update public.posts set share_count = share_count + 1 where id = new.shared_post_id;
    end if;
  else
    if old.is_share and old.shared_post_id is not null then
      update public.posts set share_count = greatest(share_count - 1, 0) where id = old.shared_post_id;
    end if;
  end if;
  return null;
end;
$$;
create trigger posts_share_count after insert or delete on public.posts
  for each row execute function public.bump_share_count();

-- The only way to create a share (clients cannot insert posts directly).
create or replace function public.share_post(p_post uuid, p_comment text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_comment text := btrim(coalesce(p_comment, ''));
  v_is_share boolean; v_shared uuid; v_root uuid; v_root_author uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if char_length(v_comment) > 500 then raise exception 'body_too_long'; end if;

  select p.is_share, p.shared_post_id into v_is_share, v_shared from public.posts p where p.id = p_post;
  if not found then raise exception 'post_not_found'; end if;
  v_root := case when v_is_share then v_shared else p_post end;
  if v_root is null then raise exception 'post_not_found'; end if;

  select p.author_id into v_root_author
  from public.posts p join public.profiles pr on pr.id = p.author_id
  where p.id = v_root and pr.status = 'active';
  if not found then raise exception 'post_not_found'; end if;

  if v_root_author = v_uid then raise exception 'own_post'; end if;
  if exists (select 1 from public.posts where author_id = v_uid and is_share and shared_post_id = v_root) then
    raise exception 'already_shared';
  end if;
  if (select count(*) from public.posts where author_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.posts (author_id, body, is_share, shared_post_id)
  values (v_uid, v_comment, true, v_root) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.share_post(uuid, text) from public, anon;
grant execute on function public.share_post(uuid, text) to authenticated;

-- Notifications: "X shared your post"
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_shape;
alter table public.notifications add constraint notifications_type_valid
  check (type in ('follow', 'like', 'comment', 'message', 'level_up', 'share'));
alter table public.notifications add constraint notifications_shape check (
  (type = 'follow' and actor_id is not null and post_id is null and conversation_id is null)
  or (type = 'like' and actor_id is not null and post_id is not null)
  or (type = 'comment' and actor_id is not null and post_id is not null and comment_id is not null)
  or (type = 'message' and actor_id is not null and conversation_id is not null)
  or (type = 'level_up' and actor_id is null and level is not null)
  or (type = 'share' and actor_id is not null and post_id is not null)
);
create unique index notifications_share_unique on public.notifications (recipient_id, post_id) where type = 'share';

create or replace function public.notify_on_share()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if new.is_share and new.shared_post_id is not null then
    select author_id into v_author from public.posts where id = new.shared_post_id;
    if v_author is not null and v_author <> new.author_id
       and coalesce((select s.notify_shares from public.user_settings s where s.user_id = v_author), true) then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (v_author, new.author_id, 'share', new.id) on conflict do nothing;
    end if;
  end if;
  return null;
end;
$$;
create trigger posts_notify_share after insert on public.posts
  for each row execute function public.notify_on_share();

-- XP: the original author earns XP when their post is shared. A share itself is not a new "post" for XP or levels.
insert into public.xp_rules (reason, amount, daily_cap, label, earn_text, sort_order) values
  ('post_shared', 4, 40, 'Someone shared your post', 'Get your post shared', 9)
on conflict (reason) do nothing;

create or replace function public.xp_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_orig uuid;
begin
  begin
    if new.is_share then
      perform public.touch_activity(new.author_id);
      if new.shared_post_id is not null then
        select author_id into v_orig from public.posts where id = new.shared_post_id;
        if v_orig is not null and v_orig <> new.author_id
           and exists (select 1 from public.profiles where id = new.author_id and created_at < now() - interval '24 hours') then
          perform public.award_xp(v_orig, 'post_shared', new.shared_post_id::text || ':' || new.author_id::text, new.author_id, new.shared_post_id);
        end if;
      end if;
    else
      perform public.award_xp(new.author_id, 'post_created', new.id::text, null, new.id);
      perform public.touch_activity(new.author_id);
      perform public.refresh_level(new.author_id);
    end if;
  exception when others then
    raise warning 'xp_on_post failed: %', sqlerrm;
  end;
  return null;
end;
$$;

-- Level requirements count your own posts only (not shares).
create or replace function public.refresh_level(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_xp bigint; v_old smallint; v_new smallint; v_posts bigint; v_followers bigint; v_name text;
begin
  select xp_total, level into v_xp, v_old from public.profiles where id = p_user;
  if not found then return; end if;
  select count(*) into v_posts from public.posts where author_id = p_user and not is_share;
  select count(*) into v_followers from public.follows where following_id = p_user;
  select max(level) into v_new from public.levels
    where min_xp <= v_xp and min_posts <= v_posts and min_followers <= v_followers;
  if v_new is not null and v_new > v_old then
    update public.profiles set level = v_new where id = p_user;
    select name into v_name from public.levels where level = v_new;
    insert into public.notifications (recipient_id, actor_id, type, level, preview)
    values (p_user, null, 'level_up', v_new, v_name) on conflict do nothing;
  end if;
end;
$$;

-- Admin post list now says which posts are shares.
drop function if exists public.admin_recent_posts(int, int, uuid);
create function public.admin_recent_posts(p_limit int default 20, p_offset int default 0, p_author uuid default null)
returns table (
  id uuid, author_id uuid, username text, full_name text, body text, like_count integer, comment_count integer,
  created_at timestamptz, image_paths text[], is_share boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select p.id, p.author_id, pr.username, pr.full_name, p.body, p.like_count, p.comment_count, p.created_at,
         coalesce((select array_agg(i.storage_path order by i.position) from public.post_images i where i.post_id = p.id), '{}'::text[]),
         p.is_share
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p_author is null or p.author_id = p_author
  order by p.created_at desc, p.id desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;
revoke all on function public.admin_recent_posts(int, int, uuid) from public, anon;
grant execute on function public.admin_recent_posts(int, int, uuid) to authenticated;
