-- Shared program catalog tables.
-- These hold platform-curated content that every member browses, so they are
-- admin-writable and world-readable once published. They mirror the shape the
-- app previously kept as hardcoded arrays in context/AppContext.tsx.

create table public.nutrition_plans (
  id text primary key,
  title text not null,
  description text not null default '',
  goal text not null default '',
  daily_calories integer not null default 0 check (daily_calories >= 0),
  protein integer not null default 0 check (protein >= 0),
  carbs integer not null default 0 check (carbs >= 0),
  fat integer not null default 0 check (fat >= 0),
  is_premium boolean not null default false,
  meals jsonb not null default '[]'::jsonb,
  status public.program_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger nutrition_plans_updated_at before update on public.nutrition_plans for each row execute function public.set_updated_at();

create table public.rehab_programs (
  id text primary key,
  title text not null,
  description text not null default '',
  body_part text not null default '',
  duration text not null default '',
  phases integer not null default 1 check (phases > 0),
  exercises jsonb not null default '[]'::jsonb,
  status public.program_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger rehab_programs_updated_at before update on public.rehab_programs for each row execute function public.set_updated_at();

alter table public.nutrition_plans enable row level security;
alter table public.rehab_programs enable row level security;

grant select on public.nutrition_plans, public.rehab_programs to anon, authenticated;
grant insert, update, delete on public.nutrition_plans, public.rehab_programs to authenticated;

create policy nutrition_plans_public_read on public.nutrition_plans
  for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy nutrition_plans_admin_write on public.nutrition_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy rehab_programs_public_read on public.rehab_programs
  for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy rehab_programs_admin_write on public.rehab_programs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
