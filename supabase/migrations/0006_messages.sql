-- Pulse phase 7: private messaging. Run ONCE in the Supabase SQL editor (after 0005).
-- Security: only the two people in a conversation can read it or write to it (enforced by the database,
-- not the app). Conversations are created through start_conversation(), one per pair of people.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text not null unique,                 -- "smaller-id:larger-id": one conversation per pair
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index conversations_last_message_idx on public.conversations (last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id, conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 2000)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_created_idx on public.messages (sender_id, created_at desc);

-- Used by the access rules (security definer avoids recursive rules on the participants table).
create or replace function public.is_participant(p_conversation uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = auth.uid()
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

revoke all on public.conversations, public.conversation_participants, public.messages from anon;
revoke insert, update, delete on public.conversations, public.conversation_participants from authenticated;
revoke update, delete on public.messages from authenticated;

create policy conversations_select on public.conversations for select to authenticated
  using (public.is_participant(id));
create policy participants_select on public.conversation_participants for select to authenticated
  using (public.is_participant(conversation_id));
create policy messages_select on public.messages for select to authenticated
  using (public.is_participant(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_participant(conversation_id));

-- Before each message: sender must be active, max 30 messages a minute, text trimmed.
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = new.sender_id and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- After each message: bump the conversation so it moves to the top of the inbox.
create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Start (or reopen) a conversation with someone. Safe to call repeatedly.
create or replace function public.start_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_other is null or p_other = v_uid then raise exception 'invalid_user'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'account_unavailable';
  end if;
  if not exists (select 1 from public.profiles where id = p_other and status = 'active') then
    raise exception 'user_unavailable';
  end if;

  v_key := least(v_uid::text, p_other::text) || ':' || greatest(v_uid::text, p_other::text);
  select id into v_id from public.conversations where direct_key = v_key;

  if v_id is null then
    if (select count(*) from public.conversations where created_by = v_uid and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'rate_limited';
    end if;
    insert into public.conversations (direct_key, created_by) values (v_key, v_uid)
      on conflict (direct_key) do nothing returning id into v_id;
    if v_id is null then select id into v_id from public.conversations where direct_key = v_key; end if;
    insert into public.conversation_participants (conversation_id, user_id)
      values (v_id, v_uid), (v_id, p_other) on conflict do nothing;
  end if;

  return v_id;
end;
$$;

-- Marks everything in a conversation as read (uses the database clock).
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
$$;

-- Inbox: one row per conversation that has messages, newest first, with the unread count.
create or replace function public.my_conversations(p_limit int default 30, p_before timestamptz default null)
returns table (
  conversation_id uuid, other_id uuid, other_username text, other_full_name text, other_avatar_url text,
  last_body text, last_sender_id uuid, last_at timestamptz, unread_count bigint
)
language sql stable security invoker set search_path = public as $$
  select c.id, o.user_id, p.username, p.full_name, p.avatar_url, lm.body, lm.sender_id, c.last_message_at,
         (select count(*) from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > me.last_read_at)
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_participants o on o.conversation_id = c.id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  join lateral (
    select m.body, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and (p_before is null or c.last_message_at < p_before)
  order by c.last_message_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- Number of conversations with something unread (for the badge).
create or replace function public.unread_conversation_count()
returns integer language sql stable security invoker set search_path = public as $$
  select count(*)::int from public.conversation_participants me
  where me.user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.conversation_id = me.conversation_id and m.sender_id <> me.user_id and m.created_at > me.last_read_at
    )
$$;

revoke all on function public.is_participant(uuid), public.start_conversation(uuid), public.mark_conversation_read(uuid),
  public.my_conversations(int, timestamptz), public.unread_conversation_count() from public, anon;
grant execute on function public.is_participant(uuid), public.start_conversation(uuid), public.mark_conversation_read(uuid),
  public.my_conversations(int, timestamptz), public.unread_conversation_count() to authenticated;

-- Live updates: let the browser hear about new messages (only ones it is allowed to see).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
