-- PulseHive reports and moderation queue. Run ONCE in the Supabase SQL editor (after 0011).
-- Members can report a post, a comment or an account. Reports can only be created through report_content()
-- (which checks everything and limits spam) and can only be read or resolved by admins. A copy of the reported
-- text is saved with the report, so admins can still see it even if it is edited or deleted later.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null,
  target_key text not null,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  comment_id uuid references public.post_comments (id) on delete set null,
  reason text not null,
  details text,
  snapshot text,
  status text not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint reports_type_valid check (target_type in ('post', 'comment', 'user')),
  constraint reports_reason_valid check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'other')),
  constraint reports_status_valid check (status in ('open', 'dismissed', 'actioned')),
  constraint reports_details_length check (details is null or char_length(details) <= 300)
);
create unique index reports_one_per_reporter_target on public.reports (reporter_id, target_key) where reporter_id is not null;
create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_key);
create index reports_reporter_created_idx on public.reports (reporter_id, created_at desc);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;   -- only the functions below can touch it

-- Admin log: new kinds of action
alter table public.admin_actions drop constraint admin_actions_action_valid;
alter table public.admin_actions add constraint admin_actions_action_valid check (
  action in ('suspend_user', 'deactivate_user', 'reactivate_user', 'delete_post', 'delete_comment', 'dismiss_report', 'resolve_report')
);

-- Report something. You cannot report yourself, report the same thing twice, or send more than 10 an hour.
create or replace function public.report_content(p_type text, p_target uuid, p_reason text, p_details text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_target_user uuid; v_post uuid; v_comment uuid; v_snap text; v_rows integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if p_reason is null or p_reason not in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'other') then
    raise exception 'invalid_reason';
  end if;
  if v_details is not null and char_length(v_details) > 300 then raise exception 'details_too_long'; end if;
  if (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;

  if p_type = 'post' then
    select p.author_id, coalesce(nullif(left(btrim(p.body), 300), ''), '(photo or shared post)')
      into v_target_user, v_snap from public.posts p where p.id = p_target;
    if not found then raise exception 'target_not_found'; end if;
    v_post := p_target;
  elsif p_type = 'comment' then
    select c.author_id, left(btrim(c.body), 300), c.post_id
      into v_target_user, v_snap, v_post from public.post_comments c where c.id = p_target;
    if not found then raise exception 'target_not_found'; end if;
    v_comment := p_target;
  elsif p_type = 'user' then
    select pr.id, left('Profile: ' || pr.full_name || ' (@' || pr.username || ') ' || coalesce(pr.bio, ''), 300)
      into v_target_user, v_snap from public.profiles pr where pr.id = p_target and pr.status = 'active';
    if not found then raise exception 'target_not_found'; end if;
  else
    raise exception 'invalid_type';
  end if;

  if v_target_user = v_uid then raise exception 'own_content'; end if;

  insert into public.reports (reporter_id, target_type, target_key, target_user_id, post_id, comment_id, reason, details, snapshot)
  values (v_uid, p_type, p_type || ':' || p_target::text, v_target_user, v_post, v_comment, p_reason, v_details, v_snap)
  on conflict (reporter_id, target_key) where reporter_id is not null do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'already_reported'; end if;
end;
$$;

-- Admin: the queue
create or replace function public.admin_list_reports(p_status text default 'open', p_limit int default 20, p_offset int default 0)
returns table (
  id uuid, created_at timestamptz, target_type text, reason text, details text, snapshot text, status text,
  reporter_username text, target_user_id uuid, target_username text, target_full_name text,
  post_id uuid, comment_id uuid, report_count bigint, resolved_at timestamptz, resolved_by_username text, resolution_note text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select r.id, r.created_at, r.target_type, r.reason, r.details, r.snapshot, r.status,
         rp.username, r.target_user_id, tu.username, tu.full_name, r.post_id, r.comment_id,
         (select count(*) from public.reports x where x.target_key = r.target_key),
         r.resolved_at, rb.username, r.resolution_note
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tu on tu.id = r.target_user_id
  left join public.profiles rb on rb.id = r.resolved_by
  where (p_status = 'all' or (p_status = 'open' and r.status = 'open') or (p_status = 'closed' and r.status <> 'open'))
  order by r.created_at desc, r.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_open_report_count()
returns bigint language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return (select count(*) from public.reports where status = 'open');
end;
$$;

-- Close a report: "dismissed" (nothing wrong) or "actioned" (dealt with). Recorded in the admin log.
create or replace function public.admin_resolve_report(p_report uuid, p_decision text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  perform public.assert_admin();
  if p_decision not in ('dismissed', 'actioned') then raise exception 'invalid_decision'; end if;

  update public.reports
  set status = p_decision, resolved_by = auth.uid(), resolved_at = now(),
      resolution_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_report and status = 'open'
  returning target_user_id into v_target;
  if not found then raise exception 'report_not_found'; end if;

  insert into public.admin_actions (admin_id, action, target_user_id, reason)
  values (auth.uid(), case p_decision when 'dismissed' then 'dismiss_report' else 'resolve_report' end, v_target,
          nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

-- Remove a comment with a recorded reason; open reports about it are closed.
create or replace function public.admin_delete_comment(p_comment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  perform public.assert_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  select author_id into v_author from public.post_comments where id = p_comment;
  if not found then raise exception 'comment_not_found'; end if;

  update public.reports
  set status = 'actioned', resolved_by = auth.uid(), resolved_at = now(), resolution_note = 'Comment removed: ' || btrim(p_reason)
  where status = 'open' and target_type = 'comment' and comment_id = p_comment;

  delete from public.post_comments where id = p_comment;

  insert into public.admin_actions (admin_id, action, target_user_id, reason)
  values (auth.uid(), 'delete_comment', v_author, btrim(p_reason));
end;
$$;

-- Removing a post now also closes open reports about it.
create or replace function public.admin_delete_post(p_post uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_paths text[];
begin
  perform public.assert_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  select author_id into v_author from public.posts where id = p_post;
  if not found then raise exception 'post_not_found'; end if;

  update public.reports
  set status = 'actioned', resolved_by = auth.uid(), resolved_at = now(), resolution_note = 'Post removed: ' || btrim(p_reason)
  where status = 'open' and target_type = 'post' and post_id = p_post;

  select array_agg(storage_path) into v_paths from public.post_images where post_id = p_post;
  delete from public.posts where id = p_post;

  begin   -- stop serving the photos (the stored file may remain until storage is cleaned up)
    if v_paths is not null then
      delete from storage.objects where bucket_id = 'post-images' and name = any (v_paths);
    end if;
  exception when others then
    raise warning 'admin_delete_post: could not remove image records: %', sqlerrm;
  end;

  insert into public.admin_actions (admin_id, action, target_user_id, target_post_id, reason)
  values (auth.uid(), 'delete_post', v_author, p_post, btrim(p_reason));
end;
$$;

revoke all on function public.report_content(text, uuid, text, text), public.admin_list_reports(text, int, int),
  public.admin_open_report_count(), public.admin_resolve_report(uuid, text, text),
  public.admin_delete_comment(uuid, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text), public.admin_list_reports(text, int, int),
  public.admin_open_report_count(), public.admin_resolve_report(uuid, text, text),
  public.admin_delete_comment(uuid, text) to authenticated;
