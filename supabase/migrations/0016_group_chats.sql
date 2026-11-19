-- PulseHive group chats. Run ONCE in the Supabase SQL editor (after 0015).
-- A group chat is a conversation with a name and 3 to 50 people. The creator is the owner and can add people,
-- remove people and rename it; anyone can leave. People added later only see messages from the moment they joined.
-- Adding someone respects their "Who can message me" setting. Everything is enforced by the database.

alter table public.conversations
  add column is_group boolean not null default false,
  add column name text;
alter table public.conversations alter column direct_key drop not null;
alter table public.conversations add constraint conversations_kind_shape check (
  (is_group and direct_key is null and name is not null and char_length(btrim(name)) between 1 and 60)
  or (not is_group and direct_key is not null)
);

alter table public.conversation_participants
  add column role text not null default 'member',
  add constraint conversation_participants_role_valid check (role in ('owner', 'member'));

alter table public.messages
  add column kind text not null default 'text',
  add constraint messages_kind_valid check (kind in ('text', 'system'));   -- system = "Ada added Ben"; only the database can write these

-- People who join later cannot read what was said before they joined.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid() and messages.created_at >= cp.created_at
  ));

-- Can this person be added to a chat / messaged by that sender? (their privacy setting)
create or replace function public.can_be_messaged_by(p_target uuid, p_sender uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.user_settings us
    where us.user_id = p_target
      and (us.message_permission = 'nobody'
           or (us.message_permission = 'following'
               and not exists (select 1 from public.follows f where f.follower_id = p_target and f.following_id = p_sender)))
  );
$$;
revoke all on function public.can_be_messaged_by(uuid, uuid) from public, anon, authenticated;

-- Messages: system messages skip the checks; one-to-one chats still respect the recipient's setting; groups do not
-- re-check it on every message (it was checked when they were added).
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_group boolean;
begin
  if new.kind = 'system' then return new; end if;
  if not exists (select 1 from public.profiles where id = new.sender_id and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if (select count(*) from public.messages where sender_id = new.sender_id and kind = 'text' and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;

  select c.is_group into v_group from public.conversations c where c.id = new.conversation_id;
  if not coalesce(v_group, false) then
    for r in
      select cp.user_id from public.conversation_participants cp
      where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
    loop
      if not public.can_be_messaged_by(r.user_id, new.sender_id) then raise exception 'messages_not_allowed'; end if;
    end loop;
  end if;

  new.body := btrim(new.body);
  return new;
end;
$$;

-- Notifications: none for system messages; group messages say which group.
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_group boolean; v_name text;
begin
  if new.kind = 'system' then return null; end if;
  select c.is_group, c.name into v_group, v_name from public.conversations c where c.id = new.conversation_id;
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
      insert into public.notifications (recipient_id, actor_id, type, conversation_id, preview)
      values (r.user_id, new.sender_id, 'message', new.conversation_id, case when coalesce(v_group, false) then v_name else null end);
    end if;
  end loop;
  return null;
end;
$$;

-- When someone leaves or is removed: a group with nobody left is deleted, and an owner-less group passes to its oldest member.
create or replace function public.participants_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_group boolean; v_next uuid;
begin
  select is_group into v_group from public.conversations where id = old.conversation_id;
  if v_group is null or not v_group then return null; end if;
  if not exists (select 1 from public.conversation_participants where conversation_id = old.conversation_id) then
    delete from public.conversations where id = old.conversation_id;
  elsif old.role = 'owner'
        and not exists (select 1 from public.conversation_participants where conversation_id = old.conversation_id and role = 'owner') then
    select user_id into v_next from public.conversation_participants
      where conversation_id = old.conversation_id order by created_at, user_id limit 1;
    update public.conversation_participants set role = 'owner' where conversation_id = old.conversation_id and user_id = v_next;
  end if;
  return null;
end;
$$;
create trigger participants_after_delete after delete on public.conversation_participants
  for each row execute function public.participants_after_delete();

-- Inbox: now includes group chats, and ignores system messages when counting unread.
drop function if exists public.my_conversations(int, timestamptz);
create function public.my_conversations(p_limit int default 30, p_before timestamptz default null)
returns table (
  conversation_id uuid, is_group boolean, group_name text, member_count bigint,
  other_id uuid, other_username text, other_full_name text, other_avatar_url text,
  last_body text, last_kind text, last_sender_id uuid, last_sender_name text, last_at timestamptz, unread_count bigint
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.is_group, c.name,
         (select count(*) from public.conversation_participants x where x.conversation_id = c.id),
         o.user_id, p.username, p.full_name, p.avatar_url,
         lm.body, lm.kind, lm.sender_id, sp.full_name, c.last_message_at,
         (select count(*) from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.kind = 'text' and m.created_at > me.last_read_at)
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (
    select cp.user_id from public.conversation_participants cp
    where cp.conversation_id = c.id and cp.user_id <> me.user_id order by cp.created_at limit 1
  ) o on not c.is_group
  left join public.profiles p on p.id = o.user_id
  join lateral (
    select m.body, m.kind, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) lm on true
  left join public.profiles sp on sp.id = lm.sender_id
  where me.user_id = auth.uid()
    and (p_before is null or c.last_message_at < p_before)
    and (c.is_group or p.id is not null)
  order by c.last_message_at desc
  limit least(greatest(p_limit, 1), 50)
$$;
revoke all on function public.my_conversations(int, timestamptz) from public, anon;
grant execute on function public.my_conversations(int, timestamptz) to authenticated;

create or replace function public.unread_conversation_count()
returns integer language sql stable security invoker set search_path = public as $$
  select count(*)::int from public.conversation_participants me
  where me.user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.conversation_id = me.conversation_id and m.sender_id <> me.user_id and m.kind = 'text' and m.created_at > me.last_read_at
    )
$$;

-- Group actions ------------------------------------------------------------------------------------------------
create or replace function public.create_group_chat(p_name text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_ids uuid[]; v_id uuid; v_creator text; m uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then raise exception 'account_unavailable'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then raise exception 'invalid_name'; end if;

  select array_agg(distinct x) into v_ids from unnest(coalesce(p_members, '{}'::uuid[])) as x where x <> v_uid;
  if coalesce(array_length(v_ids, 1), 0) < 2 then raise exception 'need_more_people'; end if;
  if array_length(v_ids, 1) > 49 then raise exception 'group_full'; end if;
  if (select count(*) from public.profiles where id = any (v_ids) and status = 'active') <> array_length(v_ids, 1) then
    raise exception 'user_unavailable';
  end if;
  foreach m in array v_ids loop
    if not public.can_be_messaged_by(m, v_uid) then raise exception 'cannot_add'; end if;
  end loop;
  if (select count(*) from public.conversations where created_by = v_uid and is_group and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into public.conversations (is_group, name, created_by) values (true, v_name, v_uid) returning id into v_id;
  insert into public.conversation_participants (conversation_id, user_id, role) values (v_id, v_uid, 'owner');
  insert into public.conversation_participants (conversation_id, user_id) select v_id, x from unnest(v_ids) as x;

  select full_name into v_creator from public.profiles where id = v_uid;
  insert into public.messages (conversation_id, sender_id, body, kind) values (v_id, v_uid, v_creator || ' created the group', 'system');
  return v_id;
end;
$$;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_new uuid[]; v_names text; v_actor text; m uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
    where c.id = p_conversation and c.is_group and cp.user_id = v_uid and cp.role = 'owner'
  ) then raise exception 'not_owner'; end if;

  select array_agg(distinct x) into v_new from unnest(coalesce(p_members, '{}'::uuid[])) as x
  where x <> v_uid and not exists (select 1 from public.conversation_participants cp where cp.conversation_id = p_conversation and cp.user_id = x);
  if v_new is null then raise exception 'nobody_to_add'; end if;
  if (select count(*) from public.conversation_participants where conversation_id = p_conversation) + array_length(v_new, 1) > 50 then
    raise exception 'group_full';
  end if;
  if (select count(*) from public.profiles where id = any (v_new) and status = 'active') <> array_length(v_new, 1) then
    raise exception 'user_unavailable';
  end if;
  foreach m in array v_new loop
    if not public.can_be_messaged_by(m, v_uid) then raise exception 'cannot_add'; end if;
  end loop;

  insert into public.conversation_participants (conversation_id, user_id) select p_conversation, x from unnest(v_new) as x;
  select string_agg(full_name, ', ' order by full_name) into v_names from public.profiles where id = any (v_new);
  select full_name into v_actor from public.profiles where id = v_uid;
  insert into public.messages (conversation_id, sender_id, body, kind)
  values (p_conversation, v_uid, left(v_actor || ' added ' || v_names, 1500), 'system');
end;
$$;

create or replace function public.remove_group_member(p_conversation uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_actor text; v_target text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
    where c.id = p_conversation and c.is_group and cp.user_id = v_uid and cp.role = 'owner'
  ) then raise exception 'not_owner'; end if;
  if p_user = v_uid then raise exception 'use_leave'; end if;
  if not exists (select 1 from public.conversation_participants where conversation_id = p_conversation and user_id = p_user) then
    raise exception 'not_a_member';
  end if;

  select full_name into v_actor from public.profiles where id = v_uid;
  select full_name into v_target from public.profiles where id = p_user;
  insert into public.messages (conversation_id, sender_id, body, kind)
  values (p_conversation, v_uid, v_actor || ' removed ' || coalesce(v_target, 'a member'), 'system');
  delete from public.conversation_participants where conversation_id = p_conversation and user_id = p_user;
end;
$$;

create or replace function public.leave_group(p_conversation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
    where c.id = p_conversation and c.is_group and cp.user_id = v_uid
  ) then raise exception 'not_a_member'; end if;

  select full_name into v_name from public.profiles where id = v_uid;
  insert into public.messages (conversation_id, sender_id, body, kind) values (p_conversation, v_uid, v_name || ' left', 'system');
  delete from public.conversation_participants where conversation_id = p_conversation and user_id = v_uid;
end;
$$;

create or replace function public.rename_group(p_conversation uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text := btrim(coalesce(p_name, '')); v_actor text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.conversations c join public.conversation_participants cp on cp.conversation_id = c.id
    where c.id = p_conversation and c.is_group and cp.user_id = v_uid and cp.role = 'owner'
  ) then raise exception 'not_owner'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then raise exception 'invalid_name'; end if;

  update public.conversations set name = v_name where id = p_conversation;
  select full_name into v_actor from public.profiles where id = v_uid;
  insert into public.messages (conversation_id, sender_id, body, kind)
  values (p_conversation, v_uid, v_actor || ' renamed the group to "' || v_name || '"', 'system');
end;
$$;

revoke all on function public.create_group_chat(text, uuid[]), public.add_group_members(uuid, uuid[]),
  public.remove_group_member(uuid, uuid), public.leave_group(uuid), public.rename_group(uuid, text) from public, anon;
grant execute on function public.create_group_chat(text, uuid[]), public.add_group_members(uuid, uuid[]),
  public.remove_group_member(uuid, uuid), public.leave_group(uuid), public.rename_group(uuid, text) to authenticated;
