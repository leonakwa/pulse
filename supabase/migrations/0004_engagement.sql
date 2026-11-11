-- Pulse phase 5: likes, comments, follow safety. Run ONCE in the Supabase SQL editor (after 0003).
-- Counters on posts are kept by database triggers, so they cannot be faked from the browser.

alter table public.posts
  add column like_count integer not null default 0,
  add column comment_count integer not null default 0,
  add constraint posts_counts_nonnegative check (like_count >= 0 and comment_count >= 0);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)                       -- one like per person per post
);
create index post_likes_user_created_idx on public.post_likes (user_id, created_at desc);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint post_comments_body_length check (char_length(btrim(body)) between 1 and 300)
);
create index post_comments_post_created_idx on public.post_comments (post_id, created_at, id);
create index post_comments_author_created_idx on public.post_comments (author_id, created_at desc);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
revoke all on public.post_likes, public.post_comments from anon;
revoke update on public.post_likes, public.post_comments from authenticated;

create policy post_likes_select on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_likes.post_id));
create policy post_likes_insert_own on public.post_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_likes.post_id)
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'active')
  );
create policy post_likes_delete_own on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

create policy post_comments_select on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_comments.post_id));
create policy post_comments_insert_own on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_comments.post_id)
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'active')
  );
create policy post_comments_delete_own on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Follows: you can only follow active accounts (self-follow and duplicates are already blocked).
drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = following_id and p.status = 'active')
  );

-- Counters (security definer so they can update columns clients cannot touch).
create or replace function public.bump_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.bump_like_count();

create or replace function public.bump_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger post_comments_count after insert or delete on public.post_comments
  for each row execute function public.bump_comment_count();

-- Counter updates must not touch updated_at or re-run the edit rules: only act when the text changed.
create or replace function public.posts_before_update()
returns trigger language plpgsql as $$
begin
  if new.body is not distinct from old.body then
    return new;
  end if;
  new.body := trim(new.body);
  if new.body = '' and not exists (select 1 from public.post_images where post_id = new.id) then
    raise exception 'empty_post';
  end if;
  new.edited_at := now();
  new.updated_at := now();
  return new;
end;
$$;

-- Spam limits (per user, per hour).
create or replace function public.limit_likes() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.post_likes where user_id = new.user_id and created_at > now() - interval '1 hour') >= 300 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger post_likes_limit before insert on public.post_likes
  for each row execute function public.limit_likes();

create or replace function public.limit_comments() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.post_comments where author_id = new.author_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger post_comments_limit before insert on public.post_comments
  for each row execute function public.limit_comments();

create or replace function public.limit_follows() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.follows where follower_id = new.follower_id and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;
create trigger follows_limit before insert on public.follows
  for each row execute function public.limit_follows();
