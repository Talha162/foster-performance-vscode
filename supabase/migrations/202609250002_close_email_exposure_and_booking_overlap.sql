-- Follow-up to 202609250001, which narrowed profile reads but deliberately left
-- coaches world-readable so the Coaches tab could keep working. That left a
-- confirmed hole: a signed-in member could still read a coach's email, because
-- RLS filters rows, not columns.
--
-- The app never needs a coach's contact details to render a directory; it needs
-- a name and an avatar. So coaches come out of the row policy entirely and
-- display fields move to a definer function that cannot return an email.

-- One function now serves every "show me who this user is" case: the coach
-- directory, review authors and the leaderboard. It exposes three columns and
-- no way to ask for more.
create or replace function public.public_display_profiles(p_user_ids uuid[])
returns table (id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.avatar_url
  from public.profiles p
  where p.id = any(p_user_ids);
$$;

revoke all on function public.public_display_profiles(uuid[]) from public;
grant execute on function public.public_display_profiles(uuid[]) to authenticated;

-- Superseded by the function above.
drop function if exists public.leaderboard_display_names(uuid[]);

-- Coaches are no longer an exception. What remains: your own row, admins, and
-- the counterparty on a booking or conversation you are part of. A coach you
-- have actually booked stays visible, which is the relationship that justifies
-- seeing contact details in the first place.
drop policy if exists profiles_select_scoped on public.profiles;

create policy profiles_select_scoped on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or public.is_admin()
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

-- ----------------------------------------------------------------- bookings
-- Nothing stopped two members booking the same coach for the same time. The
-- check belongs in the database rather than the client, because bookings are
-- created by the billing edge function and could also be inserted directly.
--
-- Cancelled, refunded and no-show bookings release their slot, so they are
-- excluded from the constraint.
create extension if not exists btree_gist;

alter table public.bookings
  drop constraint if exists bookings_no_overlapping_coach_slot;

alter table public.bookings
  add constraint bookings_no_overlapping_coach_slot
  exclude using gist (
    coach_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status not in ('cancelled', 'refunded', 'no_show'));
