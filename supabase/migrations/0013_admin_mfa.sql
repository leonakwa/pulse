-- PulseHive: admin two-step login. Run ONCE in the Supabase SQL editor (after 0012).
-- From now on every admin function refuses to run unless the person has signed in with a code from their
-- authenticator app (the "aal2" level), even if someone has stolen the admin's password.
-- IMPORTANT: turn on two-step login for your own account FIRST (Settings > Two-step login), then run this file.
-- If you ever get locked out (lost phone), see the note at the bottom.

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
end;
$$;

-- LOCKED OUT? Run this in the SQL editor to remove two-step login from one admin account (put your username in):
--   delete from auth.mfa_factors where user_id = (select id from public.profiles where username = 'ak_leon');
-- Then sign in again and set it up again. To switch the extra check off completely, run the 0009 version of assert_admin.
