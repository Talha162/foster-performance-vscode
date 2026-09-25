-- Three RLS problems, all confirmed against the live project rather than only
-- read from source.
--
-- 1. profiles was readable in full by any authenticated user. A plain member
--    account enumerated every row and read every user's email. phone and the
--    Stripe customer/subscription ids sit in the same table and would leak the
--    same way once billing is populated.
-- 2. bookings let either participant update every column, including
--    price_cents, status and the Stripe payment fields.
-- 3. messages let any conversation participant update any message in that
--    conversation. The check was on conversation membership only, never on
--    sender_id, so a member could rewrite the coach's message body.

-- ----------------------------------------------------------------- profiles
-- Visible rows: your own; anything an admin reads; coaches, since the app has
-- to browse them as a public listing; and the counterparty on a booking or
-- conversation you belong to. Everyone else disappears, which is what stops
-- bulk enumeration of the member base.
--
-- The subqueries below read coach_profiles, bookings and conversations. None of
-- those policies read profiles back, so this does not recurse.
drop policy if exists profiles_select_authenticated on public.profiles;

create policy profiles_select_scoped on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or public.is_admin()
  or exists (select 1 from public.coach_profiles cp where cp.user_id = profiles.id)
  or exists (
    select 1 from public.bookings b
    where (b.member_id = (select auth.uid()) and b.coach_id  = profiles.id)
       or (b.coach_id  = (select auth.uid()) and b.member_id = profiles.id)
  )
  or exists (
    select 1 from public.conversations c
    where (c.member_id = (select auth.uid()) and c.coach_id  = profiles.id)
       or (c.coach_id  = (select auth.uid()) and c.member_id = profiles.id)
  )
);

-- The leaderboard ranks the entire user base, so it needs display names for
-- people the policy above now hides. Returning only id and name keeps contact
-- details out of it.
create or replace function public.leaderboard_display_names(p_user_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any(p_user_ids);
$$;

revoke all on function public.leaderboard_display_names(uuid[]) from public;
grant execute on function public.leaderboard_display_names(uuid[]) to authenticated;

-- Friend requests are addressed by email. The caller already typed the address,
-- so resolving it to an id reveals nothing new, and returning just the id keeps
-- the rest of the profile out of reach.
create or replace function public.find_profile_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where lower(p.email) = lower(btrim(p_email))
  limit 1;
$$;

revoke all on function public.find_profile_id_by_email(text) from public;
grant execute on function public.find_profile_id_by_email(text) to authenticated;

-- ----------------------------------------------------------------- bookings
-- Participants keep row access, but may only write the columns describing
-- their own intent. Price, schedule and payment state stay server-owned.
revoke update on public.bookings from authenticated;
grant update (status, cancellation_reason, cancelled_at, member_notes, coach_notes)
  on public.bookings to authenticated;

-- ----------------------------------------------------------------- messages
-- The only legitimate client write is marking the other person's message read.
-- Body and attachment are now immutable from the client.
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
