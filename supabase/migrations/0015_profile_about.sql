-- PulseHive profile "About": education, work, hometown and current city. Run ONCE in the Supabase SQL editor (after 0014).
-- Each item (or each place) is either Public (other members can see it) or Only me. This is enforced by the database,
-- so an "Only me" item can never be read by anyone else, even by asking the database directly.

create table public.profile_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_name text not null,
  kind text not null default 'secondary',
  field_of_study text,
  start_year smallint,
  end_year smallint,
  is_current boolean not null default false,
  description text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  constraint profile_education_school_len check (char_length(btrim(school_name)) between 1 and 100),
  constraint profile_education_kind_valid check (kind in ('primary', 'secondary', 'college', 'university', 'other')),
  constraint profile_education_field_len check (field_of_study is null or char_length(field_of_study) <= 100),
  constraint profile_education_desc_len check (description is null or char_length(description) <= 300),
  constraint profile_education_years check (
    (start_year is null or start_year between 1900 and 2100)
    and (end_year is null or end_year between 1900 and 2100)
    and (start_year is null or end_year is null or end_year >= start_year)
    and (not is_current or end_year is null)
  ),
  constraint profile_education_visibility_valid check (visibility in ('public', 'only_me'))
);
create index profile_education_user_idx on public.profile_education (user_id, start_year desc nulls last, created_at);

create table public.profile_work (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company text not null,
  position text,
  location text,
  start_year smallint,
  end_year smallint,
  is_current boolean not null default false,
  description text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  constraint profile_work_company_len check (char_length(btrim(company)) between 1 and 100),
  constraint profile_work_position_len check (position is null or char_length(position) <= 100),
  constraint profile_work_location_len check (location is null or char_length(location) <= 100),
  constraint profile_work_desc_len check (description is null or char_length(description) <= 300),
  constraint profile_work_years check (
    (start_year is null or start_year between 1900 and 2100)
    and (end_year is null or end_year between 1900 and 2100)
    and (start_year is null or end_year is null or end_year >= start_year)
    and (not is_current or end_year is null)
  ),
  constraint profile_work_visibility_valid check (visibility in ('public', 'only_me'))
);
create index profile_work_user_idx on public.profile_work (user_id, start_year desc nulls last, created_at);

create table public.profile_places (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_city text,
  hometown text,
  visibility text not null default 'public',
  updated_at timestamptz not null default now(),
  constraint profile_places_city_len check (current_city is null or char_length(current_city) <= 60),
  constraint profile_places_home_len check (hometown is null or char_length(hometown) <= 60),
  constraint profile_places_visibility_valid check (visibility in ('public', 'only_me'))
);
create trigger profile_places_set_updated_at before update on public.profile_places
  for each row execute function public.set_updated_at();

-- Access rules ---------------------------------------------------------------------------------------------
alter table public.profile_education enable row level security;
alter table public.profile_work enable row level security;
alter table public.profile_places enable row level security;
revoke all on public.profile_education, public.profile_work, public.profile_places from anon;

revoke insert, update on public.profile_education from authenticated;
grant insert (user_id, school_name, kind, field_of_study, start_year, end_year, is_current, description, visibility)
  on public.profile_education to authenticated;
grant update (school_name, kind, field_of_study, start_year, end_year, is_current, description, visibility)
  on public.profile_education to authenticated;

revoke insert, update on public.profile_work from authenticated;
grant insert (user_id, company, position, location, start_year, end_year, is_current, description, visibility)
  on public.profile_work to authenticated;
grant update (company, position, location, start_year, end_year, is_current, description, visibility)
  on public.profile_work to authenticated;

revoke insert, update on public.profile_places from authenticated;
grant insert (user_id, current_city, hometown, visibility) on public.profile_places to authenticated;
grant update (current_city, hometown, visibility) on public.profile_places to authenticated;

create policy profile_education_select on public.profile_education for select to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or (visibility = 'public' and exists (select 1 from public.profiles p where p.id = user_id and p.status = 'active')));
create policy profile_education_insert_own on public.profile_education for insert to authenticated with check (user_id = auth.uid());
create policy profile_education_update_own on public.profile_education for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_education_delete_own on public.profile_education for delete to authenticated using (user_id = auth.uid());

create policy profile_work_select on public.profile_work for select to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or (visibility = 'public' and exists (select 1 from public.profiles p where p.id = user_id and p.status = 'active')));
create policy profile_work_insert_own on public.profile_work for insert to authenticated with check (user_id = auth.uid());
create policy profile_work_update_own on public.profile_work for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_work_delete_own on public.profile_work for delete to authenticated using (user_id = auth.uid());

create policy profile_places_select on public.profile_places for select to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or (visibility = 'public' and exists (select 1 from public.profiles p where p.id = user_id and p.status = 'active')));
create policy profile_places_insert_own on public.profile_places for insert to authenticated with check (user_id = auth.uid());
create policy profile_places_update_own on public.profile_places for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Up to 10 education items and 10 jobs each.
create or replace function public.limit_about_items() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'profile_education' then
    if (select count(*) from public.profile_education where user_id = new.user_id) >= 10 then raise exception 'too_many_items'; end if;
  else
    if (select count(*) from public.profile_work where user_id = new.user_id) >= 10 then raise exception 'too_many_items'; end if;
  end if;
  return new;
end;
$$;
create trigger profile_education_limit before insert on public.profile_education for each row execute function public.limit_about_items();
create trigger profile_work_limit before insert on public.profile_work for each row execute function public.limit_about_items();

-- A little XP the first time you add education and the first time you add work (once each, ever).
insert into public.xp_rules (reason, amount, daily_cap, label, earn_text, sort_order) values
  ('about_education', 10, 10, 'Added your education', 'Add your education to your profile (once)', 13),
  ('about_work', 10, 10, 'Added your work', 'Add your work to your profile (once)', 14)
on conflict (reason) do nothing;

create or replace function public.xp_on_about() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_table_name = 'profile_education' then
      perform public.award_xp(new.user_id, 'about_education', 'first');
    else
      perform public.award_xp(new.user_id, 'about_work', 'first');
    end if;
  exception when others then
    raise warning 'xp_on_about failed: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger profile_education_xp after insert on public.profile_education for each row execute function public.xp_on_about();
create trigger profile_work_xp after insert on public.profile_work for each row execute function public.xp_on_about();
