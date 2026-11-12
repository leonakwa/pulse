-- Pulse phase 9: XP, levels, streaks and leaderboard. Run ONCE in the Supabase SQL editor (after 0007).
-- SECURITY: XP is only ever written by database triggers reacting to real actions. The browser cannot
-- insert or change XP, levels or streaks. Spam protection: daily caps per action, one award per unique
-- event, no XP for your own likes/comments, and accounts must be 24 hours old before their likes,
-- comments and follows earn XP for others.
-- TUNING: every number lives in two small tables (xp_rules and levels). Add rows to levels for 15 or 20 levels.

-- Levels: the narrative ladder. To reach a level you need ALL THREE: XP, posts and followers. -----------
create table public.levels (
  level smallint primary key,
  name text not null,
  tagline text not null,
  min_xp integer not null,
  min_posts integer not null,
  min_followers integer not null
);
insert into public.levels (level, name, tagline, min_xp, min_posts, min_followers) values
  (1,  'Static',    'You just tuned in. Nobody has heard you yet.',                 0,     0,   0),
  (2,  'Signal',    'A faint signal gets through. People begin to notice you.',     150,   3,   0),
  (3,  'Spark',     'Something catches. Your words start sparking replies.',        400,   8,   2),
  (4,  'Heartbeat', 'A steady presence. The community can feel you.',               900,   20,  5),
  (5,  'Rhythm',    'You have found your beat, and you keep it.',                   1800,  40,  12),
  (6,  'Echo',      'What you say comes back. Others repeat and answer you.',       3200,  70,  25),
  (7,  'Wave',      'Your reach rolls outward, far beyond your circle.',            5500,  110, 50),
  (8,  'Resonance', 'You move people. Conversations hum around you.',               9000,  160, 100),
  (9,  'Beacon',    'Others find their way by your light.',                         14000, 230, 200),
  (10, 'Legend',    'You are the pulse of Pulse.',                                  22000, 320, 400);

-- XP rules: what each action is worth, and the most it can earn per day (UTC). ---------------------------
create table public.xp_rules (
  reason text primary key,
  amount integer not null check (amount > 0),
  daily_cap integer not null check (daily_cap >= amount),
  label text not null,        -- shown in XP history
  earn_text text not null,    -- shown in "how to earn XP"
  sort_order smallint not null
);
insert into public.xp_rules (reason, amount, daily_cap, label, earn_text, sort_order) values
  ('post_created',      10, 30, 'Published a post',                 'Publish a post',                                   1),
  ('comment_made',       3, 30, 'Commented on a post',              'Write a thoughtful comment (10+ characters) on someone else''s post', 2),
  ('like_received',      2, 40, 'Someone liked your post',          'Get a like on your post',                          3),
  ('comment_received',   4, 40, 'Someone commented on your post',   'Get a comment on your post',                       4),
  ('follower_gained',    5, 50, 'New follower',                     'Gain a new follower',                              5),
  ('follow_made',        1,  5, 'Followed someone',                 'Follow someone new',                               6),
  ('daily_active',       5,  5, 'Daily activity',                   'Do anything on Pulse each day (post, comment, like or follow)', 7),
  ('streak_week',       25, 25, '7-day streak bonus',               'Stay active 7 days in a row',                      8);

-- Ledger: every XP award, append-only. ----------------------------------------------------------------
create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null references public.xp_rules (reason),
  amount integer not null check (amount > 0),
  dedupe_key text,
  source_user_id uuid references public.profiles (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index xp_transactions_user_idx on public.xp_transactions (user_id, created_at desc, id desc);
create index xp_transactions_created_idx on public.xp_transactions (created_at);
create unique index xp_transactions_dedupe_unique on public.xp_transactions (user_id, reason, dedupe_key)
  where dedupe_key is not null;                           -- the same event can never pay twice

create table public.user_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_day date
);

alter table public.profiles
  add column xp_total bigint not null default 0,
  add column level smallint not null default 1;
create index profiles_xp_idx on public.profiles (xp_total desc) where status = 'active';

-- Access: read-only for everyone signed in (own rows for private tables); nobody writes from the browser.
alter table public.levels enable row level security;
alter table public.xp_rules enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.user_streaks enable row level security;
revoke all on public.levels, public.xp_rules, public.xp_transactions, public.user_streaks from anon;
revoke insert, update, delete on public.levels, public.xp_rules, public.xp_transactions, public.user_streaks from authenticated;
create policy levels_select on public.levels for select to authenticated using (true);
create policy xp_rules_select on public.xp_rules for select to authenticated using (true);
create policy xp_transactions_select_own on public.xp_transactions for select to authenticated using (user_id = auth.uid());
create policy user_streaks_select_own on public.user_streaks for select to authenticated using (user_id = auth.uid());

-- Level-up notifications (no actor) ---------------------------------------------------------------------
alter table public.notifications alter column actor_id drop not null;
alter table public.notifications add column level smallint;
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_not_self;
alter table public.notifications drop constraint notifications_shape;
alter table public.notifications add constraint notifications_type_valid
  check (type in ('follow', 'like', 'comment', 'message', 'level_up'));
alter table public.notifications add constraint notifications_not_self
  check (actor_id is null or recipient_id <> actor_id);
alter table public.notifications add constraint notifications_shape check (
  (type = 'follow' and actor_id is not null and post_id is null and conversation_id is null)
  or (type = 'like' and actor_id is not null and post_id is not null)
  or (type = 'comment' and actor_id is not null and post_id is not null and comment_id is not null)
  or (type = 'message' and actor_id is not null and conversation_id is not null)
  or (type = 'level_up' and actor_id is null and level is not null)
);
create unique index notifications_level_unique on public.notifications (recipient_id, level) where type = 'level_up';

-- Engine (internal: only the triggers below call these) -----------------------------------------------------
-- Moves you up when XP, posts AND followers are all high enough. Levels never go down.
create or replace function public.refresh_level(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_xp bigint; v_old smallint; v_new smallint; v_posts bigint; v_followers bigint; v_name text;
begin
  select xp_total, level into v_xp, v_old from public.profiles where id = p_user;
  if not found then return; end if;
  select count(*) into v_posts from public.posts where author_id = p_user;
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

-- Awards XP if the rule exists, the daily cap allows it, and this exact event has not paid before.
create or replace function public.award_xp(p_user uuid, p_reason text, p_dedupe text default null,
                                           p_source uuid default null, p_post uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_rule public.xp_rules%rowtype; v_today integer; v_rows integer;
begin
  select * into v_rule from public.xp_rules where reason = p_reason;
  if not found then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'active') then return; end if;

  select coalesce(sum(amount), 0) into v_today from public.xp_transactions
  where user_id = p_user and reason = p_reason
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  if v_today + v_rule.amount > v_rule.daily_cap then return; end if;

  insert into public.xp_transactions (user_id, reason, amount, dedupe_key, source_user_id, post_id)
  values (p_user, p_reason, v_rule.amount, p_dedupe, p_source, p_post) on conflict do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.profiles set xp_total = xp_total + v_rule.amount where id = p_user;
    perform public.refresh_level(p_user);
  end if;
end;
$$;

-- Counts a day of activity (for streaks and the daily bonus).
create or replace function public.touch_activity(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'utc')::date; v_last date; v_streak integer;
begin
  insert into public.user_streaks (user_id) values (p_user) on conflict do nothing;
  select last_active_day, current_streak into v_last, v_streak
  from public.user_streaks where user_id = p_user for update;
  if v_last = v_today then return; end if;
  v_streak := case when v_last = v_today - 1 then v_streak + 1 else 1 end;
  update public.user_streaks
  set current_streak = v_streak, longest_streak = greatest(longest_streak, v_streak), last_active_day = v_today
  where user_id = p_user;
  perform public.award_xp(p_user, 'daily_active', v_today::text);
  if v_streak % 7 = 0 then perform public.award_xp(p_user, 'streak_week', v_today::text); end if;
end;
$$;

-- Triggers. XP is best-effort: if anything here ever fails, the user's post/like/comment still works. --------
create or replace function public.xp_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.award_xp(new.author_id, 'post_created', new.id::text, null, new.id);
    perform public.touch_activity(new.author_id);
    perform public.refresh_level(new.author_id);
  exception when others then
    raise warning 'xp_on_post failed: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger posts_xp after insert on public.posts for each row execute function public.xp_on_post();

create or replace function public.xp_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  begin
    select author_id into v_author from public.posts where id = new.post_id;
    perform public.touch_activity(new.author_id);
    -- Only real comments on other people's posts earn XP.
    if v_author is not null and v_author <> new.author_id and char_length(btrim(new.body)) >= 10 then
      perform public.award_xp(new.author_id, 'comment_made', new.post_id::text, null, new.post_id);
      if exists (select 1 from public.profiles where id = new.author_id and created_at < now() - interval '24 hours') then
        perform public.award_xp(v_author, 'comment_received', new.post_id::text || ':' || new.author_id::text, new.author_id, new.post_id);
      end if;
    end if;
  exception when others then
    raise warning 'xp_on_comment failed: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger post_comments_xp after insert on public.post_comments for each row execute function public.xp_on_comment();

create or replace function public.xp_on_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  begin
    select author_id into v_author from public.posts where id = new.post_id;
    perform public.touch_activity(new.user_id);
    if v_author is not null and v_author <> new.user_id
       and exists (select 1 from public.profiles where id = new.user_id and created_at < now() - interval '24 hours') then
      perform public.award_xp(v_author, 'like_received', new.post_id::text || ':' || new.user_id::text, new.user_id, new.post_id);
    end if;
  exception when others then
    raise warning 'xp_on_like failed: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger post_likes_xp after insert on public.post_likes for each row execute function public.xp_on_like();

create or replace function public.xp_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.touch_activity(new.follower_id);
    perform public.award_xp(new.follower_id, 'follow_made', new.following_id::text, new.following_id, null);
    if exists (select 1 from public.profiles where id = new.follower_id and created_at < now() - interval '24 hours') then
      perform public.award_xp(new.following_id, 'follower_gained', new.follower_id::text, new.follower_id, null);
    end if;
    perform public.refresh_level(new.following_id);
  exception when others then
    raise warning 'xp_on_follow failed: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger follows_xp after insert on public.follows for each row execute function public.xp_on_follow();

-- Leaderboard: public ranking info only (rank, level, XP). period = 'weekly' (last 7 days) or 'all'. ------------
create or replace function public.leaderboard_page(p_period text default 'weekly', p_limit int default 25, p_offset int default 0)
returns table (place bigint, user_id uuid, username text, full_name text, avatar_url text, level smallint, level_name text, xp bigint)
language sql stable security definer set search_path = public as $$
  with scores as (
    select p.id, p.username, p.full_name, p.avatar_url, p.level, p.created_at,
           case when p_period = 'all' then p.xp_total else coalesce(w.xp, 0) end as xp
    from public.profiles p
    left join (
      select t.user_id, sum(t.amount) as xp from public.xp_transactions t
      where t.created_at > now() - interval '7 days' group by t.user_id
    ) w on w.user_id = p.id
    where p.status = 'active'
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
    left join (
      select t.user_id, sum(t.amount) as xp from public.xp_transactions t
      where t.created_at > now() - interval '7 days' group by t.user_id
    ) w on w.user_id = p.id
    where p.status = 'active'
  ), ranked as (
    select s.id, s.xp, rank() over (order by s.xp desc) as rnk from scores s where s.xp > 0
  )
  select r.rnk, r.xp::bigint from ranked r where r.id = auth.uid()
$$;

revoke all on function public.refresh_level(uuid), public.award_xp(uuid, text, text, uuid, uuid),
  public.touch_activity(uuid) from public, anon, authenticated;
revoke all on function public.leaderboard_page(text, int, int), public.my_leaderboard_rank(text) from public, anon;
grant execute on function public.leaderboard_page(text, int, int), public.my_leaderboard_rank(text) to authenticated;
