alter table public.user_app_state
  add column if not exists privacy_preferences jsonb not null default '{
    "health": true,
    "analytics": false,
    "marketing": false
  }'::jsonb;
