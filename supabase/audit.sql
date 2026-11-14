-- PulseHive security and integrity audit.
-- READ-ONLY: it only looks at your database and changes nothing. Safe to run any time.
-- Run it in the Supabase SQL Editor and send a screenshot of the result table (scroll to show every row).

select check_name, result from (

  select 1 as n, 'Tables WITHOUT row level security (want: 0)' as check_name, count(*)::text as result
  from pg_tables where schemaname = 'public' and not rowsecurity

  union all
  select 2, 'Tables with security on but no rules (expect only: admin_actions, admin_users)',
         coalesce(string_agg(c.relname, ', ' order by c.relname), 'none')
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policies pol where pol.schemaname = 'public' and pol.tablename = c.relname)

  union all
  select 3, 'Functions a visitor who is NOT signed in can run (expect only: is_admin, username_available)',
         coalesce(string_agg(p.proname, ', ' order by p.proname), 'none')
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.prorettype <> 'trigger'::regtype and has_function_privilege('anon', p.oid, 'execute')

  union all
  select 4, 'Functions signed-in users can run (review: nothing here should be able to hand out XP or edit other people)',
         coalesce(string_agg(p.proname, ', ' order by p.proname), 'none')
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.prorettype <> 'trigger'::regtype and has_function_privilege('authenticated', p.oid, 'execute')

  union all
  select 5, 'Tables signed-in users may INSERT into directly (expect: follows, messages, post_comments, post_likes)',
         coalesce(string_agg(distinct tablename, ', ' order by tablename), 'none')
  from pg_policies where schemaname = 'public' and cmd = 'INSERT'

  union all
  select 6, 'Tables signed-in users may UPDATE directly (expect: posts, profiles, user_settings)',
         coalesce(string_agg(distinct tablename, ', ' order by tablename), 'none')
  from pg_policies where schemaname = 'public' and cmd = 'UPDATE'

  union all
  select 7, 'Tables signed-in users may DELETE from directly (expect: follows, post_comments, post_likes, posts)',
         coalesce(string_agg(distinct tablename, ', ' order by tablename), 'none')
  from pg_policies where schemaname = 'public' and cmd = 'DELETE'

  union all
  select 8, 'Profile columns users can edit (expect: avatar_url, bio, cover_url, full_name, is_private, location, username)',
         coalesce(string_agg(column_name, ', ' order by column_name), 'none')
  from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE'

  union all
  select 9, 'Photo buckets',
         coalesce(string_agg(b.id || ' (public: ' || b.public::text || ', max ' || coalesce((b.file_size_limit / 1048576)::text || ' MB', 'no limit') || ')', '; '), 'none')
  from storage.buckets b

  union all
  select 10, 'Admins (expect only you)',
         coalesce(string_agg(pr.username || ' (' || a.role || ')', ', '), 'none')
  from public.admin_users a join public.profiles pr on pr.id = a.user_id

  union all
  select 11, 'Sign-ins with no profile (want: 0)', count(*)::text
  from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)

  union all
  select 12, 'Posts whose like count is wrong (want: 0)', count(*)::text
  from public.posts p where p.like_count <> (select count(*) from public.post_likes l where l.post_id = p.id)

  union all
  select 13, 'Posts whose comment count is wrong (want: 0)', count(*)::text
  from public.posts p where p.comment_count <> (select count(*) from public.post_comments c where c.post_id = p.id)

  union all
  select 14, 'Posts whose share count is wrong (want: 0)', count(*)::text
  from public.posts p where p.share_count <> (select count(*) from public.posts s where s.is_share and s.shared_post_id = p.id)

  union all
  select 15, 'People whose XP does not match their XP history (want: 0)', count(*)::text
  from public.profiles p where p.xp_total <> coalesce((select sum(t.amount) from public.xp_transactions t where t.user_id = p.id), 0)

  union all
  select 16, 'Tables sending live updates (expect: messages, notifications)',
         coalesce(string_agg(tablename, ', ' order by tablename), 'none')
  from pg_publication_tables where pubname = 'supabase_realtime'

) checks
order by n;
