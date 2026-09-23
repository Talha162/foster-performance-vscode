alter table public.user_app_state
  add column if not exists notification_preferences jsonb not null default '{
    "workoutReminders": true,
    "coachMessages": true,
    "weeklyProgress": true,
    "nutritionReminders": true,
    "sessionReminders": true,
    "achievements": true,
    "platformNews": false
  }'::jsonb;
