create table public.user_app_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active_workout_id text,
  active_nutrition_id text,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;
revoke all on table public.user_app_state from anon, authenticated;
grant select, insert, update, delete on public.user_app_state to authenticated;
create policy user_app_state_owner on public.user_app_state for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
create trigger user_app_state_updated_at before update on public.user_app_state for each row execute function public.set_updated_at();

create table public.health_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_on date not null default current_date,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index health_checkins_user_date_idx on public.health_checkins (user_id, recorded_on desc);
alter table public.health_checkins enable row level security;
revoke all on table public.health_checkins from anon, authenticated;
grant select, insert, update, delete on public.health_checkins to authenticated;
create policy health_checkins_owner on public.health_checkins for all to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

insert into public.platform_settings (key, value, description)
values ('fp_score_weights', '{"workoutConsistency":30,"sleepDuration":20,"waterIntake":10,"recoveryScore":15,"cardioEndurance":10,"strengthProgress":5,"mobilityScore":5,"bodyFatProgress":5}'::jsonb, 'Global FP Score component weights.')
on conflict (key) do nothing;
