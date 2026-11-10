-- Pulse foundation schema: profiles, settings, follows, admins.
-- Run in the Supabase SQL editor before starting the app.
-- Security model: Row Level Security on every table; users write only their own rows;
-- sensitive columns (status) cannot be changed from the client.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text not null,
  bio text,
  location text,
  avatar_url text,
  cover_url text,
  is_private boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_full_name_length check (char_length(full_name) between 1 and 60),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 160),
  constraint profiles_location_length check (location is null or char_length(location) <= 60),
  constraint profiles_status_valid check (status in ('active', 'suspended', 'deactivated'))
);
create unique index profiles_username_key on public.profiles (username);
create index profiles_full_name_idx on public.profiles (lower(full_name));
create index profiles_created_at_idx on public.profiles (created_at desc);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system',
  notify_follows boolean not null default true,
  notify_likes boolean not null default true,
  notify_comments boolean not null default true,
  notify_messages boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint user_settings_theme_valid check (theme in ('light', 'dark', 'system'))
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id, created_at desc);
create index follows_follower_idx on public.follows (follower_id, created_at desc);

-- Admins: RLS on with no policies, so unreadable from the client.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint admin_users_role_valid check (role in ('admin', 'moderator'))
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- Lets the sign-up form check a username before creating the account.
create or replace function public.username_available(p_username text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(p_username));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Creates the profile and settings rows when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'New user')
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.follows enable row level security;
alter table public.admin_users enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (status = 'active' or id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Only these columns are editable from the client. status is not.
revoke update on public.profiles from authenticated;
grant update (username, full_name, bio, location, avatar_url, cover_url, is_private)
  on public.profiles to authenticated;

create policy user_settings_select_own on public.user_settings for select to authenticated
  using (user_id = auth.uid());
create policy user_settings_update_own on public.user_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = auth.uid());
create policy follows_delete_own on public.follows for delete to authenticated
  using (follower_id = auth.uid());
