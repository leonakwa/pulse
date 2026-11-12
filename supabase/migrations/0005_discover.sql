-- Pulse phase 6: search, suggestions, popular posts. Safe to run more than once.
-- Search runs inside the database with parameters (no user text is ever pasted into a query),
-- and uses your normal access rules, so suspended accounts never appear.

create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_username_trgm_idx on public.profiles using gin (username extensions.gin_trgm_ops);
create index if not exists profiles_full_name_trgm_idx on public.profiles using gin (lower(full_name) extensions.gin_trgm_ops);
create index if not exists posts_popular_idx on public.posts (like_count desc, comment_count desc, created_at desc);

-- Find people by username or name. Exact and prefix matches come first.
create or replace function public.search_profiles(p_query text, p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, full_name text, bio text, avatar_url text, is_following boolean)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select lower(btrim(replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_'))) as t
  )
  select p.id, p.username, p.full_name, p.bio, p.avatar_url,
         exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id) as is_following
  from public.profiles p, q
  where p.status = 'active'
    and char_length(q.t) >= 2
    and (p.username like '%' || q.t || '%' escape '\' or lower(p.full_name) like '%' || q.t || '%' escape '\')
  order by
    (p.username = q.t) desc,
    (p.username like q.t || '%' escape '\') desc,
    (lower(p.full_name) like q.t || '%' escape '\') desc,
    p.username
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0)
$$;

-- People you do not follow yet, most-followed first.
create or replace function public.suggested_accounts(p_limit int default 10)
returns table (id uuid, username text, full_name text, bio text, avatar_url text, follower_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.bio, p.avatar_url,
         (select count(*) from public.follows f where f.following_id = p.id) as follower_count
  from public.profiles p
  where p.status = 'active'
    and p.id <> auth.uid()
    and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = p.id)
  order by follower_count desc, p.created_at desc
  limit least(greatest(p_limit, 1), 30)
$$;

revoke all on function public.search_profiles(text, int, int) from public, anon;
revoke all on function public.suggested_accounts(int) from public, anon;
grant execute on function public.search_profiles(text, int, int) to authenticated;
grant execute on function public.suggested_accounts(int) to authenticated;
