-- PulseHive: private standing + comment likes and replies. Run ONCE in the Supabase SQL editor (after 0013).
--  1. The leaderboard is private: each person can see only their OWN standing, never anyone else's.
--  2. Comments can be liked and replied to (one level of replies), with XP and notifications.
--  3. Hardening: members can only fill in the intended columns when they add likes, follows, comments or messages.

-- 1. Private standing -----------------------------------------------------------------------------------------
drop function if exists public.leaderboard_page(text, int, int);
drop function if exists public.my_leaderboard_rank(text);
alter table public.user_settings drop column if exists show_on_leaderboard;

create or replace function public.my_standing(p_period text default 'weekly')
returns table (place bigint, xp bigint, ranked bigint)
language sql stable security definer set search_path = public as $$
  with scores as (
    select p.id,
           case when p_period = 'all' then p.xp_total else coalesce(w.xp, 0) end as xp
    from public.profiles p
    left join (
      select t.user_id, sum(t.amount) as xp from public.xp_transactions t
      where t.created_at > now() - interval '7 days' group by t.user_id
    ) w on w.user_id = p.id
    where p.status = 'active'
  ), ranked as (
    select s.id, s.xp, rank() over (order by s.xp desc) as rnk, count(*) over () as total
    from scores s where s.xp > 0
  )
  select r.rnk, r.xp::bigint, r.total from ranked r where r.id = auth.uid()
$$;
revoke all on function public.my_standing(text) from public, anon;
grant execute on function public.my_standing(text) to authenticated;

-- 2. Comment replies and likes ---------------------------------------------------------------------------------
alter table public.post_comments
  add column parent_id uuid references public.post_comments (id) on delete cascade,
  add column like_count integer not null default 0,
  add column reply_count integer not null default 0,
  add constraint post_comments_counts_nonnegative check (like_count >= 0 and reply_count >= 0);
create index post_comments_parent_idx on public.post_comments (parent_id, created_at, id) where parent_id is not null;

create table public.comment_likes (
  comment_id uuid not null references public.post_comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_created_idx on public.comment_likes (user_id, created_at desc);

alter table public.comment_likes enable row level security;
revoke all on public.comment_likes from anon;
revoke update on public.comment_likes from authenticated;
create policy comment_likes_select on public.comment_likes for select to authenticated
  using (exists (select 1 from public.post_comments c where c.id = comment_likes.comment_id));
create policy comment_likes_insert_own on public.comment_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.post_comments c where c.id = comment_likes.comment_id)
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'active')
  );
create policy comment_likes_delete_own on public.comment_likes for delete to authenticated
  using (user_id = auth.uid());

-- Replies: only one level deep, and only inside the same post.
create or replace function public.post_comments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_post uuid; v_parent_parent uuid;
begin
  if new.parent_id is not null then
    select post_id, parent_id into v_post, v_parent_parent from public.post_comments where id = new.parent_id;
    if not found or v_post <> new.post_id then raise exception 'invalid_parent'; end if;
    if v_parent_parent is not null then raise exception 'reply_too_deep'; end if;
  end if;
  return new;
end;
$$;
create trigger post_comments_before_insert before insert on public.post_comments
  for each row execute function public.post_comments_before_insert();

-- Counters (kept by the database, so they cannot be faked).
create or replace function public.bump_reply_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      update public.post_comments set reply_count = reply_count + 1 where id = new.parent_id;
    end if;
  else
    if old.parent_id is not null then
      update public.post_comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
    end if;
  end if;
  return null;
end;
$$;
create trigger post_comments_reply_count after insert or delete on public.post_comments
  for each row execute function public.bump_reply_count();

create or replace function public.bump_comment_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.post_comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.post_comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;
create trigger comment_likes_count after insert or delete on public.comment_likes
  for each row execute function public.bump_comment_like_count();

create or replace function public.limit_comment_likes() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.comment_likes where user_id = new.user_id and created_at > now() - interval '1 hour') >= 300 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger comment_likes_limit before insert on public.comment_likes
  for each row execute function public.limit_comment_likes();

-- Notifications: "X replied to your comment" and "X liked your comment"
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_shape;
alter table public.notifications add constraint notifications_type_valid
  check (type in ('follow', 'like', 'comment', 'message', 'level_up', 'share', 'reply', 'comment_like'));
alter table public.notifications add constraint notifications_shape check (
  (type = 'follow' and actor_id is not null and post_id is null and conversation_id is null)
  or (type = 'like' and actor_id is not null and post_id is not null)
  or (type = 'comment' and actor_id is not null and post_id is not null and comment_id is not null)
  or (type = 'message' and actor_id is not null and conversation_id is not null)
  or (type = 'level_up' and actor_id is null and level is not null)
  or (type = 'share' and actor_id is not null and post_id is not null)
  or (type = 'reply' and actor_id is not null and post_id is not null and comment_id is not null)
  or (type = 'comment_like' and actor_id is not null and post_id is not null and comment_id is not null)
);
create unique index notifications_reply_unique on public.notifications (comment_id) where type = 'reply';
create unique index notifications_comment_like_unique on public.notifications (actor_id, comment_id) where type = 'comment_like';

-- A top-level comment notifies the post's author; a reply notifies the author of the comment replied to.
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_post_author uuid; v_parent_author uuid;
begin
  if new.parent_id is null then
    select author_id into v_post_author from public.posts where id = new.post_id;
    if v_post_author is not null and v_post_author <> new.author_id
       and coalesce((select s.notify_comments from public.user_settings s where s.user_id = v_post_author), true) then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id, preview)
      values (v_post_author, new.author_id, 'comment', new.post_id, new.id, left(btrim(new.body), 100)) on conflict do nothing;
    end if;
  else
    select author_id into v_parent_author from public.post_comments where id = new.parent_id;
    if v_parent_author is not null and v_parent_author <> new.author_id
       and coalesce((select s.notify_comments from public.user_settings s where s.user_id = v_parent_author), true) then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id, preview)
      values (v_parent_author, new.author_id, 'reply', new.post_id, new.id, left(btrim(new.body), 100)) on conflict do nothing;
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.notify_on_comment_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_post uuid;
begin
  if tg_op = 'INSERT' then
    select author_id, post_id into v_author, v_post from public.post_comments where id = new.comment_id;
    if v_author is not null and v_author <> new.user_id
       and coalesce((select s.notify_likes from public.user_settings s where s.user_id = v_author), true) then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (v_author, new.user_id, 'comment_like', v_post, new.comment_id) on conflict do nothing;
    end if;
  else
    delete from public.notifications where type = 'comment_like' and actor_id = old.user_id and comment_id = old.comment_id;
  end if;
  return null;
end;
$$;
create trigger comment_likes_notify after insert or delete on public.comment_likes
  for each row execute function public.notify_on_comment_like();

-- XP for comment likes and replies (a reply earns reply XP instead of comment XP, so nothing is paid twice)
insert into public.xp_rules (reason, amount, daily_cap, label, earn_text, sort_order) values
  ('comment_like_received', 1, 20, 'Someone liked your comment', 'Get a like on your comment', 10),
  ('reply_made', 2, 20, 'Replied to a comment', 'Reply to someone''s comment (10+ characters)', 11),
  ('reply_received', 3, 30, 'Someone replied to your comment', 'Get a reply to your comment', 12)
on conflict (reason) do nothing;

create or replace function public.xp_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_post_author uuid; v_parent_author uuid;
begin
  begin
    perform public.touch_activity(new.author_id);
    if char_length(btrim(new.body)) >= 10 then
      if new.parent_id is null then
        select author_id into v_post_author from public.posts where id = new.post_id;
        if v_post_author is not null and v_post_author <> new.author_id then
          perform public.award_xp(new.author_id, 'comment_made', new.post_id::text, null, new.post_id);
          if exists (select 1 from public.profiles where id = new.author_id and created_at < now() - interval '24 hours') then
            perform public.award_xp(v_post_author, 'comment_received', new.post_id::text || ':' || new.author_id::text, new.author_id, new.post_id);
          end if;
        end if;
      else
        select author_id into v_parent_author from public.post_comments where id = new.parent_id;
        if v_parent_author is not null and v_parent_author <> new.author_id then
          perform public.award_xp(new.author_id, 'reply_made', new.parent_id::text, null, new.post_id);
          if exists (select 1 from public.profiles where id = new.author_id and created_at < now() - interval '24 hours') then
            perform public.award_xp(v_parent_author, 'reply_received', new.parent_id::text || ':' || new.author_id::text, new.author_id, new.post_id);
          end if;
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'xp_on_comment failed: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.xp_on_comment_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  begin
    select author_id into v_author from public.post_comments where id = new.comment_id;
    perform public.touch_activity(new.user_id);
    if v_author is not null and v_author <> new.user_id
       and exists (select 1 from public.profiles where id = new.user_id and created_at < now() - interval '24 hours') then
      perform public.award_xp(v_author, 'comment_like_received', new.comment_id::text || ':' || new.user_id::text, new.user_id, null);
    end if;
  exception when others then
    raise warning 'xp_on_comment_like failed: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger comment_likes_xp after insert on public.comment_likes
  for each row execute function public.xp_on_comment_like();

-- 3. Hardening: members can only fill in the intended columns (no forged counters, dates or ids). -------------------
revoke insert on public.post_comments from authenticated;
grant insert (post_id, author_id, body, parent_id) on public.post_comments to authenticated;
revoke insert on public.comment_likes from authenticated;
grant insert (comment_id, user_id) on public.comment_likes to authenticated;
revoke insert on public.post_likes from authenticated;
grant insert (post_id, user_id) on public.post_likes to authenticated;
revoke insert on public.follows from authenticated;
grant insert (follower_id, following_id) on public.follows to authenticated;
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
