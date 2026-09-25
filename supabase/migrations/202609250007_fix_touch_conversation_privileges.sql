-- Regression from 202609250006. That migration revoked UPDATE on conversations
-- and re-granted only last_message_at, so the blocked person could not clear
-- blocked_by. But the touch_conversation trigger, which runs on every message
-- insert, updates last_message_at AND updated_at. The caller no longer held
-- updated_at, the trigger failed, and the whole INSERT was rejected: sending
-- any message returned 403, blocked or not.
--
-- Widening the grant would work but is the wrong shape. This trigger is
-- server-side bookkeeping and should not depend on what columns the client can
-- write, so it becomes security definer instead. The client then needs no
-- UPDATE on conversations at all: blocking goes through set_conversation_block
-- and nothing else in the app updates the row directly.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at, updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

revoke update on public.conversations from authenticated;
