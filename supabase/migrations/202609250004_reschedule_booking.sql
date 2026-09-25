-- Rescheduling has to move starts_at and ends_at, but members are deliberately
-- not granted those columns: a direct grant would let anyone drop a booking
-- into the past or shift it to dodge a cancellation window. This function makes
-- the move on their behalf and checks the things a client cannot be trusted to.
--
-- Overlap is not re-checked here; the exclusion constraint added in
-- 202609250002 rejects a clashing slot and surfaces as an error to the caller.
create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'That booking no longer exists.';
  end if;

  if not (v_booking.member_id = (select auth.uid())
          or v_booking.coach_id = (select auth.uid())
          or public.is_admin()) then
    raise exception 'You can only reschedule your own bookings.';
  end if;

  if v_booking.status in ('cancelled', 'refunded', 'completed', 'no_show') then
    raise exception 'A % booking cannot be rescheduled.', v_booking.status;
  end if;

  if p_starts_at <= now() then
    raise exception 'Pick a time in the future.';
  end if;

  update public.bookings
  set starts_at = p_starts_at,
      ends_at = p_starts_at + make_interval(mins => v_booking.session_length_minutes),
      status = 'upcoming'
  where id = p_booking_id;
end;
$$;

revoke all on function public.reschedule_booking(uuid, timestamptz) from public;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;
