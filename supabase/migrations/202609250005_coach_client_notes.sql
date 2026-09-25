-- The client detail screen offers "private coach notes" with nothing to store
-- them in, so they were kept in component state and lost on navigation.
--
-- These are the coach's own observations about a client, and the screen states
-- that only the coach should see them, so the policy is deliberately narrower
-- than most: the client they describe cannot read them.
create table public.coach_client_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index coach_client_notes_lookup on public.coach_client_notes (coach_id, client_id, created_at desc);

alter table public.coach_client_notes enable row level security;

grant select, insert, update, delete on public.coach_client_notes to authenticated;

-- Admins are included so support can investigate a complaint about a coach.
create policy coach_client_notes_author_read on public.coach_client_notes
  for select to authenticated
  using (coach_id = (select auth.uid()) or public.is_admin());

create policy coach_client_notes_author_insert on public.coach_client_notes
  for insert to authenticated
  with check (coach_id = (select auth.uid()) and public.is_coach());

create policy coach_client_notes_author_update on public.coach_client_notes
  for update to authenticated
  using (coach_id = (select auth.uid()))
  with check (coach_id = (select auth.uid()));

create policy coach_client_notes_author_delete on public.coach_client_notes
  for delete to authenticated
  using (coach_id = (select auth.uid()) or public.is_admin());
