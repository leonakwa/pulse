-- Pulse phase 8: notifications. Run ONCE in the Supabase SQL editor (after 0006).
-- Notifications are created by database triggers when real things happen (a follow, a like, a comment,
-- a message). Nobody can create or edit them from the browser. They respect each person's notification
-- settings (user_settings.notify_*), never notify you about your own actions, and are removed again when
-- the action is undone (unlike, unfollow, deleted comment).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.post_comments (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  preview text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_valid check (type in ('follow', 'like', 'comment', 'message')),
  constraint notifications_not_self check (recipient_id <> actor_id),
  constraint notifications_shape check (
    (type = 'follow' and post_id is null and conversation_id is null)
    or (type = 'like' and post_id is not null)
    or (type = 'comment' and post_id is not null and comment_id is not null)
    or (type = 'message' and conversation_id is not null)
  )
);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_message_idx on public.notifications (recipient_id, conversation_id) where type = 'message';
create unique index notifications_follow_unique on public.notifications (recipient_id, actor_id) where type = 'follow';
create unique index notifications_like_unique on public.notifications (actor_id, post_id) where type = 'like';
create unique index notifications_comment_unique on public.notifications (comment_id) where type = 'comment';

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

-- Follows ---------------------------------------------------------------------------------------
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if coalesce((select s.notify_follows from public.user_settings s where s.user_id = new.following_id), true) then
      insert into public.notifications (recipient_id, actor_id, type)
      values (new.following_id, new.follower_id, 'follow') on conflict do nothing;
    end if;
  else
    delete from public.notifications
    where type = 'follow' and recipient_id = old.following_id and actor_id = old.follower_id;
  end if;
  return null;
end;
$$;
create trigger follows_notify after insert or delete on public.follows
  for each row execute function public.notify_on_follow();

-- Likes -----------------------------------------------------------------------------------------
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if tg_op = 'INSERT' then
    select author_id into v_author from public.posts where id = new.post_id;
    if v_author is not null and v_author <> new.user_id
       and coalesce((select s.notify_likes from public.user_settings s where s.user_id = v_author), true) then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (v_author, new.user_id, 'like', new.post_id) on conflict do nothing;
    end if;
  else
    delete from public.notifications where type = 'like' and actor_id = old.user_id and post_id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger post_likes_notify after insert or delete on public.post_likes
  for each row execute function public.notify_on_like();

-- Comments (removed automatically with the comment) ---------------------------------------------
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.author_id
     and coalesce((select s.notify_comments from public.user_settings s where s.user_id = v_author), true) then
    insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id, preview)
    values (v_author, new.author_id, 'comment', new.post_id, new.id, left(btrim(new.body), 100)) on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger post_comments_notify after insert on public.post_comments
  for each row execute function public.notify_on_comment();

-- Messages: one notification per conversation until it is read (the inbox shows the exact counts) ---
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select user_id from public.conversation_participants
    where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    if coalesce((select s.notify_messages from public.user_settings s where s.user_id = r.user_id), true)
       and not exists (
         select 1 from public.notifications n
         where n.type = 'message' and n.recipient_id = r.user_id
           and n.conversation_id = new.conversation_id and n.read_at is null
       ) then
      insert into public.notifications (recipient_id, actor_id, type, conversation_id)
      values (r.user_id, new.sender_id, 'message', new.conversation_id);
    end if;
  end loop;
  return null;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_on_message();

-- Reading ---------------------------------------------------------------------------------------
create or replace function public.mark_notification_read(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where id = p_id and recipient_id = auth.uid() and read_at is null;
$$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where recipient_id = auth.uid() and read_at is null;
$$;

create or replace function public.unread_notification_count()
returns integer language sql stable security invoker set search_path = public as $$
  select count(*)::int from public.notifications where recipient_id = auth.uid() and read_at is null
$$;

-- Opening a conversation now also clears its message notification.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_participants set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
  update public.notifications set read_at = now()
  where recipient_id = auth.uid() and type = 'message' and conversation_id = p_conversation_id and read_at is null;
$$;

revoke all on function public.mark_notification_read(uuid), public.mark_all_notifications_read(),
  public.unread_notification_count() from public, anon;
grant execute on function public.mark_notification_read(uuid), public.mark_all_notifications_read(),
  public.unread_notification_count() to authenticated;

-- Live updates
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
