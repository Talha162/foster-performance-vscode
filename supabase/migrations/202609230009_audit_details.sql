alter table public.audit_logs
  add column if not exists details jsonb not null default '{}'::jsonb;
