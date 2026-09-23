alter table public.workout_programs
  add column if not exists price_cents integer not null default 0 check (price_cents >= 0);
