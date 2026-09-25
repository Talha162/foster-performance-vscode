-- Blocking and one-off availability exceptions.
--
-- Blocking silences a thread rather than deleting it. Conversations here carry
-- paid bookings, and moderation_reports point at conversation_id and
-- message_id, so removing a thread would destroy the evidence a support or
-- moderation case depends on. Both people keep the history; neither can add to
-- it until the person who blocked lifts it.
alter table public.conversations
  add column if not exists blocked_by uuid references public.profiles(id) on delete set null,
  add column if not exists blocked_at timestamptz;

-- Participants may update a conversation, so the block has to be set through a
-- function: a direct grant would let the blocked person clear it themselves.
revoke update on public.conversations from authenticated;
grant update (last_message_at) on public.conversations to authenticated;

create or replace function public.set_conversation_block(
  p_conversation_id uuid,
  p_blocked boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'That conversation no longer exists.';
  end if;

  if not (v_conversation.member_id = (select auth.uid())
          or v_conversation.coach_id = (select auth.uid())
          or public.is_admin()) then
    raise exception 'You are not part of that conversation.';
  end if;

  if p_blocked then
    if v_conversation.blocked_by is not null then
      return; -- already blocked; leave the original blocker in place
    end if;
    update public.conversations
    set blocked_by = (select auth.uid()), blocked_at = now()
    where id = p_conversation_id;
  else
    -- Only whoever blocked can lift it, so a blocked person cannot undo it.
    if v_conversation.blocked_by is distinct from (select auth.uid()) and not public.is_admin() then
      raise exception 'Only the person who blocked this conversation can unblock it.';
    end if;
    update public.conversations
    set blocked_by = null, blocked_at = null
    where id = p_conversation_id;
  end if;
end;
$$;

revoke all on function public.set_conversation_block(uuid, boolean) from public;
grant execute on function public.set_conversation_block(uuid, boolean) to authenticated;

-- Enforce the block where it matters: nobody adds to a blocked thread.
drop policy if exists messages_participants_insert on public.messages;

create policy messages_participants_insert on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.blocked_by is null
      and (c.member_id = (select auth.uid()) or c.coach_id = (select auth.uid()))
  )
);

-- ------------------------------------------------- availability exceptions
-- Weekly availability repeats forever, so a coach had no way to mark a holiday
-- and would simply get booked on it. Full-day closures only: partial-day
-- overrides cost a lot of complexity, and a coach needing one can change their
-- weekly hours instead.
create table public.coach_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  unavailable_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (coach_id, unavailable_on)
);

create index coach_availability_exceptions_lookup
  on public.coach_availability_exceptions (coach_id, unavailable_on);

alter table public.coach_availability_exceptions enable row level security;

grant select, insert, delete on public.coach_availability_exceptions to authenticated;

-- Members need to read these to know which days to hide when booking.
create policy coach_availability_exceptions_read on public.coach_availability_exceptions
  for select to authenticated using (true);

create policy coach_availability_exceptions_write on public.coach_availability_exceptions
  for insert to authenticated
  with check (coach_id = (select auth.uid()) or public.is_admin());

create policy coach_availability_exceptions_delete on public.coach_availability_exceptions
  for delete to authenticated
  using (coach_id = (select auth.uid()) or public.is_admin());
