-- Foster Performance Milestone 2: Supabase foundation
-- All user identities are Supabase Auth UUIDs. Every exposed table has RLS.

create extension if not exists pgcrypto;

create type public.account_role as enum ('member', 'coach_applicant', 'coach', 'owner_admin');
create type public.application_status as enum ('incomplete', 'submitted', 'under_review', 'approved', 'rejected');
create type public.booking_status as enum ('pending', 'upcoming', 'completed', 'cancelled', 'refunded', 'no_show');
create type public.program_status as enum ('draft', 'published', 'archived');
create type public.subscription_status as enum ('trial', 'active', 'pending', 'past_due', 'canceled', 'expired');
create type public.ticket_status as enum ('open', 'in_progress', 'waiting_on_member', 'resolved', 'closed');
create type public.moderation_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  role public.account_role not null default 'member',
  onboarding_complete boolean not null default false,
  goal text,
  level text check (level is null or level in ('Beginner', 'Intermediate', 'Advanced')),
  bio text,
  phone text,
  is_suspended boolean not null default false,
  is_premium boolean not null default false,
  subscription_status public.subscription_status,
  subscription_plan text check (subscription_plan is null or subscription_plan in ('monthly', 'annual')),
  subscription_end_date timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  streak_days integer not null default 0 check (streak_days >= 0),
  total_workouts integer not null default 0 check (total_workouts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    case
      when new.raw_user_meta_data ->> 'account_type' = 'coach_applicant' then 'coach_applicant'::public.account_role
      else 'member'::public.account_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'owner_admin' and not is_suspended
  );
$$;

create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('coach', 'owner_admin') and not is_suspended
  );
$$;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) = old.id and not public.is_admin() then
    if new.role is distinct from old.role
      or new.is_suspended is distinct from old.is_suspended
      or new.is_premium is distinct from old.is_premium
      or new.subscription_status is distinct from old.subscription_status
      or new.subscription_plan is distinct from old.subscription_plan
      or new.subscription_end_date is distinct from old.subscription_end_date
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
      raise exception 'Protected profile fields cannot be changed by the client';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create table public.coach_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  professional_title text,
  biography text,
  experience_years integer check (experience_years is null or experience_years >= 0),
  certifications jsonb not null default '[]'::jsonb,
  specialties jsonb not null default '[]'::jsonb,
  services jsonb not null default '[]'::jsonb,
  session_lengths jsonb not null default '[]'::jsonb,
  prices jsonb not null default '{}'::jsonb,
  weekly_availability jsonb not null default '{}'::jsonb,
  virtual_sessions boolean not null default true,
  in_person_sessions boolean not null default false,
  service_location text,
  professional_links jsonb not null default '[]'::jsonb,
  profile_photo_url text,
  resume_url text,
  agreed_to_terms boolean not null default false,
  status public.application_status not null default 'incomplete',
  admin_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_applications_updated_at before update on public.coach_applications for each row execute function public.set_updated_at();

create table public.coach_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  professional_title text not null default '',
  biography text not null default '',
  specialties text[] not null default '{}',
  credentials text[] not null default '{}',
  coach_type text not null default 'personal',
  experience_years integer not null default 0 check (experience_years >= 0),
  accepting_clients boolean not null default true,
  virtual_sessions boolean not null default true,
  in_person_sessions boolean not null default false,
  service_location text,
  session_30_price_cents integer check (session_30_price_cents is null or session_30_price_cents >= 0),
  session_60_price_cents integer check (session_60_price_cents is null or session_60_price_cents >= 0),
  session_90_price_cents integer check (session_90_price_cents is null or session_90_price_cents >= 0),
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  client_count integer not null default 0 check (client_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger coach_profiles_updated_at before update on public.coach_profiles for each row execute function public.set_updated_at();

create table public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  unique (coach_id, weekday, start_time, end_time),
  check (end_time > start_time)
);

create table public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid,
  rating smallint not null check (rating between 1 and 5),
  review_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, member_id, booking_id)
);
create trigger coach_reviews_updated_at before update on public.coach_reviews for each row execute function public.set_updated_at();

create table public.workout_programs (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  training_type text not null,
  subcategory text,
  level text not null,
  weeks integer not null check (weeks > 0),
  days_per_week integer not null check (days_per_week between 1 and 7),
  duration_minutes integer not null check (duration_minutes > 0),
  equipment text[] not null default '{}',
  category text not null,
  is_premium boolean not null default false,
  image_color text not null default '#2F80FF',
  coach_tip text not null default '',
  exercises jsonb not null default '[]'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  weekly_schedule jsonb not null default '[]'::jsonb,
  status public.program_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workout_programs_updated_at before update on public.workout_programs for each row execute function public.set_updated_at();

create table public.workout_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id text not null references public.workout_programs(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, program_id, status)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id text references public.workout_programs(id) on delete set null,
  workout_name text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  calories_burned integer check (calories_burned is null or calories_burned >= 0),
  notes text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  set_number integer not null check (set_number > 0),
  reps integer,
  weight numeric(8,2),
  distance numeric(10,2),
  duration_seconds integer,
  completed boolean not null default true,
  unique (session_id, exercise_id, set_number)
);

create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_on date not null default current_date,
  weight_kg numeric(6,2),
  body_fat_percent numeric(5,2),
  workouts_this_week integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create table public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  metric_type text not null,
  value numeric not null,
  unit text not null,
  measured_at timestamptz not null default now(),
  source text not null default 'manual'
);

create table public.fp_score_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  components jsonb not null default '{}'::jsonb,
  recorded_on date not null default current_date,
  unique (user_id, recorded_on)
);

create table public.nutrition_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  goal text,
  secondary_goals text[] not null default '{}',
  daily_calories integer not null default 2000 check (daily_calories > 0),
  protein_target integer not null default 150,
  carbs_target integer not null default 200,
  fat_target integer not null default 65,
  fiber_target integer not null default 30,
  water_target_ml integer not null default 2500,
  tracking_mode text not null default 'guided',
  dietary_pattern text not null default 'omnivore',
  allergies text[] not null default '{}',
  intolerances text[] not null default '{}',
  activity_level text not null default 'moderately_active',
  meal_frequency text not null default 'three_plus_snacks',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger nutrition_profiles_updated_at before update on public.nutrition_profiles for each row execute function public.set_updated_at();

create table public.recipes (
  id text primary key,
  title text not null,
  description text,
  category text not null default 'General',
  goal_tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  allergy_tags text[] not null default '{}',
  prep_time_mins integer not null default 10,
  cook_time_mins integer not null default 20,
  servings integer not null default 2,
  difficulty text not null default 'Easy',
  calories integer not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  sodium numeric not null default 0,
  cost_per_serving numeric not null default 0,
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  storage_notes text,
  reheat_notes text,
  equipment text[] not null default '{}',
  image_url text,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger recipes_updated_at before update on public.recipes for each row execute function public.set_updated_at();

create table public.saved_recipes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id text not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_category text not null default 'Meal',
  food_name text not null,
  brand text,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric not null default 0,
  serving_amount numeric not null default 1,
  serving_unit text not null default 'serving',
  notes text,
  recipe_id text references public.recipes(id) on delete set null,
  logged_at timestamptz not null default now()
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_ml integer not null default 250 check (amount_ml > 0),
  logged_at timestamptz not null default now()
);

create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'My Grocery List',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger grocery_lists_updated_at before update on public.grocery_lists for each row execute function public.set_updated_at();

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.grocery_lists(id) on delete cascade,
  category text not null default 'Other',
  name text not null,
  amount text not null default '',
  unit text not null default '',
  is_checked boolean not null default false,
  custom_added boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  session_length_minutes integer not null check (session_length_minutes in (30, 60, 90)),
  price_cents integer not null check (price_cents >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  status public.booking_status not null default 'pending',
  member_notes text,
  coach_notes text,
  stripe_payment_intent_id text unique,
  stripe_payment_status text,
  video_room_url text,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.coach_reviews add constraint coach_reviews_booking_id_fkey foreign key (booking_id) references public.bookings(id) on delete set null;
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, coach_id)
);
create trigger conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 5000),
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.touch_conversation()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at, updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_touch_conversation after insert on public.messages for each row execute function public.touch_conversation();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_type text not null check (product_type in ('member_premium', 'coach_pro')),
  plan text not null check (plan in ('monthly', 'annual')),
  status public.subscription_status not null default 'pending',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_type)
);
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

create table public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  updated_at timestamptz not null default now()
);

create table public.streak_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  completed boolean not null default false,
  frozen boolean not null default false,
  primary key (user_id, activity_date)
);

create table public.fp_points (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total integer not null default 0,
  weekly integer not null default 0,
  week_start date,
  updated_at timestamptz not null default now()
);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null,
  points integer not null,
  activity_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, activity_type, activity_date)
);

create table public.leagues (
  id smallint generated always as identity primary key,
  name text not null unique,
  tier smallint not null unique,
  color text not null default '#9AA3B5',
  emoji text not null default '⚡',
  minimum_points integer not null default 0
);

create table public.league_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  league_id smallint not null references public.leagues(id),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table public.leaderboard_privacy (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_mode text not null default 'first_name' check (display_mode in ('full_name', 'first_name', 'anonymous')),
  display_name text,
  show_on_global boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  challenge_type text not null default 'workout',
  duration_days integer not null default 7,
  start_date date not null,
  end_date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  is_featured boolean not null default false,
  invite_code text unique,
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  points integer not null default 0,
  primary key (challenge_id, user_id)
);

create table public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default 'trophy',
  color text not null default '#D6A84B',
  category text not null default 'general',
  condition_type text not null,
  condition_value integer not null default 1
);

create table public.user_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz,
  used_for_date date,
  earned_via text not null default 'premium',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  workout_reminders boolean not null default true,
  messages boolean not null default true,
  bookings boolean not null default true,
  achievements boolean not null default true,
  marketing boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  subject text not null,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger support_tickets_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null,
  details text,
  status public.moderation_status not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger moderation_reports_updated_at before update on public.moderation_reports for each row execute function public.set_updated_at();

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Performance indexes
create index workout_sessions_user_completed_idx on public.workout_sessions (user_id, completed_at desc);
create index progress_entries_user_date_idx on public.progress_entries (user_id, recorded_on desc);
create index food_logs_user_logged_idx on public.food_logs (user_id, logged_at desc);
create index water_logs_user_logged_idx on public.water_logs (user_id, logged_at desc);
create index bookings_member_start_idx on public.bookings (member_id, starts_at desc);
create index bookings_coach_start_idx on public.bookings (coach_id, starts_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index point_transactions_user_date_idx on public.point_transactions (user_id, activity_date desc);
create index moderation_reports_status_idx on public.moderation_reports (status, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- RLS and privileges. service_role retains implicit privileged access.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','coach_applications','coach_profiles','coach_availability','coach_reviews',
    'workout_programs','workout_enrollments','workout_sessions','workout_sets','progress_entries',
    'health_metrics','fp_score_entries','nutrition_profiles','recipes','saved_recipes','food_logs',
    'water_logs','grocery_lists','grocery_items','bookings','conversations','messages','subscriptions',
    'streaks','streak_history','fp_points','point_transactions','leagues','league_memberships',
    'friendships','leaderboard_privacy','challenges','challenge_members','achievements',
    'user_achievements','streak_freezes','notifications','notification_preferences','device_push_tokens',
    'support_tickets','support_messages','moderation_reports','audit_logs','platform_settings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.workout_programs, public.recipes, public.leagues, public.challenges, public.achievements to anon, authenticated;
grant select on public.profiles, public.coach_profiles, public.coach_availability, public.coach_reviews to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.coach_applications to authenticated;
grant insert, update, delete on public.coach_profiles, public.coach_availability to authenticated;
grant insert, update, delete on public.workout_programs, public.recipes, public.challenges, public.achievements to authenticated;
grant select, insert, update, delete on public.workout_enrollments, public.workout_sessions, public.workout_sets,
  public.progress_entries, public.health_metrics, public.fp_score_entries, public.nutrition_profiles,
  public.saved_recipes, public.food_logs, public.water_logs, public.grocery_lists, public.grocery_items,
  public.bookings, public.conversations, public.messages, public.friendships, public.challenge_members,
  public.leaderboard_privacy, public.streak_freezes, public.notification_preferences, public.device_push_tokens,
  public.support_tickets, public.support_messages, public.moderation_reports, public.coach_reviews to authenticated;
grant select on public.subscriptions, public.streaks, public.streak_history, public.fp_points, public.point_transactions,
  public.league_memberships, public.user_achievements, public.notifications, public.audit_logs, public.platform_settings to authenticated;
grant update on public.messages, public.notifications to authenticated;
grant select, insert, update, delete on public.platform_settings to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Profiles
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_update_own_or_admin on public.profiles for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- Coach domain
create policy coach_applications_select on public.coach_applications for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy coach_applications_insert on public.coach_applications for insert to authenticated with check (user_id = (select auth.uid()));
create policy coach_applications_update on public.coach_applications for update to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy coach_profiles_read on public.coach_profiles for select to authenticated using (true);
create policy coach_profiles_write on public.coach_profiles for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy coach_availability_read on public.coach_availability for select to authenticated using (true);
create policy coach_availability_write on public.coach_availability for all to authenticated using (coach_id = (select auth.uid()) or public.is_admin()) with check (coach_id = (select auth.uid()) or public.is_admin());
create policy coach_reviews_read on public.coach_reviews for select to authenticated using (true);
create policy coach_reviews_insert on public.coach_reviews for insert to authenticated with check (member_id = (select auth.uid()));
create policy coach_reviews_update on public.coach_reviews for update to authenticated using (member_id = (select auth.uid()) or public.is_admin()) with check (member_id = (select auth.uid()) or public.is_admin());
create policy coach_reviews_delete on public.coach_reviews for delete to authenticated using (member_id = (select auth.uid()) or public.is_admin());

-- Catalogs
create policy workout_programs_public_read on public.workout_programs for select to anon, authenticated using (status = 'published' or owner_id = (select auth.uid()) or public.is_admin());
create policy workout_programs_coach_insert on public.workout_programs for insert to authenticated with check ((owner_id = (select auth.uid()) and public.is_coach()) or public.is_admin());
create policy workout_programs_coach_update on public.workout_programs for update to authenticated using (owner_id = (select auth.uid()) or public.is_admin()) with check (owner_id = (select auth.uid()) or public.is_admin());
create policy workout_programs_coach_delete on public.workout_programs for delete to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy recipes_public_read on public.recipes for select to anon, authenticated using (is_published or created_by = (select auth.uid()) or public.is_admin());
create policy recipes_write on public.recipes for all to authenticated using (created_by = (select auth.uid()) or public.is_admin()) with check ((created_by = (select auth.uid()) and public.is_coach()) or public.is_admin());
create policy leagues_read on public.leagues for select to anon, authenticated using (true);
create policy challenges_read on public.challenges for select to anon, authenticated using (status in ('active','completed') or created_by = (select auth.uid()) or public.is_admin());
create policy challenges_write on public.challenges for all to authenticated using (created_by = (select auth.uid()) or public.is_admin()) with check (created_by = (select auth.uid()) or public.is_admin());
create policy achievements_read on public.achievements for select to anon, authenticated using (true);
create policy achievements_admin_write on public.achievements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Generic owner rows
create policy workout_enrollments_owner on public.workout_enrollments for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy workout_sessions_owner on public.workout_sessions for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy workout_sets_owner on public.workout_sets for all to authenticated using (exists (select 1 from public.workout_sessions s where s.id = session_id and (s.user_id = (select auth.uid()) or public.is_admin()))) with check (exists (select 1 from public.workout_sessions s where s.id = session_id and (s.user_id = (select auth.uid()) or public.is_admin())));
create policy progress_entries_owner on public.progress_entries for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy health_metrics_owner on public.health_metrics for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy fp_score_entries_owner on public.fp_score_entries for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy nutrition_profiles_owner on public.nutrition_profiles for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy saved_recipes_owner on public.saved_recipes for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy food_logs_owner on public.food_logs for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy water_logs_owner on public.water_logs for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy grocery_lists_owner on public.grocery_lists for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy grocery_items_owner on public.grocery_items for all to authenticated using (exists (select 1 from public.grocery_lists l where l.id = list_id and (l.user_id = (select auth.uid()) or public.is_admin()))) with check (exists (select 1 from public.grocery_lists l where l.id = list_id and (l.user_id = (select auth.uid()) or public.is_admin())));

-- Bookings and communication
create policy bookings_participants_read on public.bookings for select to authenticated using (member_id = (select auth.uid()) or coach_id = (select auth.uid()) or public.is_admin());
create policy bookings_member_insert on public.bookings for insert to authenticated with check (member_id = (select auth.uid()));
create policy bookings_participants_update on public.bookings for update to authenticated using (member_id = (select auth.uid()) or coach_id = (select auth.uid()) or public.is_admin()) with check (member_id = (select auth.uid()) or coach_id = (select auth.uid()) or public.is_admin());
create policy conversations_participants on public.conversations for all to authenticated using (member_id = (select auth.uid()) or coach_id = (select auth.uid()) or public.is_admin()) with check (member_id = (select auth.uid()) or coach_id = (select auth.uid()) or public.is_admin());
create policy messages_participants_read on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.member_id = (select auth.uid()) or c.coach_id = (select auth.uid()) or public.is_admin())));
create policy messages_participants_insert on public.messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists (select 1 from public.conversations c where c.id = conversation_id and (c.member_id = (select auth.uid()) or c.coach_id = (select auth.uid()))));
create policy messages_participants_update on public.messages for update to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.member_id = (select auth.uid()) or c.coach_id = (select auth.uid()) or public.is_admin()))) with check (exists (select 1 from public.conversations c where c.id = conversation_id and (c.member_id = (select auth.uid()) or c.coach_id = (select auth.uid()) or public.is_admin())));

-- Read-only server-maintained data
create policy subscriptions_owner_read on public.subscriptions for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy streaks_owner_read on public.streaks for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy streak_history_owner_read on public.streak_history for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy fp_points_read on public.fp_points for select to authenticated using (true);
create policy point_transactions_owner_read on public.point_transactions for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy league_memberships_read on public.league_memberships for select to authenticated using (true);
create policy user_achievements_read on public.user_achievements for select to authenticated using (true);

-- Social and engagement
create policy friendships_participants on public.friendships for all to authenticated using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()) or public.is_admin()) with check (requester_id = (select auth.uid()) or public.is_admin());
create policy leaderboard_privacy_owner on public.leaderboard_privacy for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy challenge_members_read on public.challenge_members for select to authenticated using (true);
create policy challenge_members_join on public.challenge_members for insert to authenticated with check (user_id = (select auth.uid()) or public.is_admin());
create policy challenge_members_leave on public.challenge_members for delete to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy streak_freezes_owner on public.streak_freezes for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());

-- Notifications
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy notification_preferences_owner on public.notification_preferences for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy device_push_tokens_owner on public.device_push_tokens for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());

-- Operations
create policy support_tickets_read on public.support_tickets for select to authenticated using (user_id = (select auth.uid()) or assigned_to = (select auth.uid()) or public.is_admin());
create policy support_tickets_insert on public.support_tickets for insert to authenticated with check (user_id = (select auth.uid()));
create policy support_tickets_update on public.support_tickets for update to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy support_messages_read on public.support_messages for select to authenticated using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = (select auth.uid()) or t.assigned_to = (select auth.uid()) or public.is_admin())));
create policy support_messages_insert on public.support_messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = (select auth.uid()) or t.assigned_to = (select auth.uid()) or public.is_admin())) and (not is_internal or public.is_admin()));
create policy moderation_reports_select on public.moderation_reports for select to authenticated using (reporter_id = (select auth.uid()) or public.is_admin());
create policy moderation_reports_insert on public.moderation_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy moderation_reports_admin_update on public.moderation_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
create policy platform_settings_authenticated_read on public.platform_settings for select to authenticated using (true);
create policy platform_settings_admin_write on public.platform_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage buckets and policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('credentials', 'credentials', false, 15728640, array['application/pdf','image/jpeg','image/png']),
  ('message-attachments', 'message-attachments', false, 26214400, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy avatars_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy avatars_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_owner_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text)) with check (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));
create policy avatars_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid()::text));
create policy credentials_owner_read on storage.objects for select to authenticated using (bucket_id = 'credentials' and (owner_id = (select auth.uid()::text) or public.is_admin()));
create policy credentials_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'credentials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy credentials_owner_update on storage.objects for update to authenticated using (bucket_id = 'credentials' and owner_id = (select auth.uid()::text)) with check (bucket_id = 'credentials' and owner_id = (select auth.uid()::text));
create policy credentials_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'credentials' and (owner_id = (select auth.uid()::text) or public.is_admin()));
create policy message_attachments_owner_read on storage.objects for select to authenticated using (bucket_id = 'message-attachments' and owner_id = (select auth.uid()::text));
create policy message_attachments_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'message-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy message_attachments_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'message-attachments' and owner_id = (select auth.uid()::text));

-- Seed stable reference data.
insert into public.leagues (name, tier, color, emoji, minimum_points) values
  ('Rookie', 1, '#9AA3B5', '⚡', 0),
  ('Bronze', 2, '#CD7F32', '🥉', 500),
  ('Silver', 3, '#C0C0C0', '🥈', 1500),
  ('Gold', 4, '#D6A84B', '🥇', 3500),
  ('Elite', 5, '#2F80FF', '🏆', 7000)
on conflict do nothing;

insert into public.achievements (id, title, description, icon, color, category, condition_type, condition_value) values
  ('first-workout', 'First Rep', 'Complete your first workout.', 'trophy', '#2F80FF', 'training', 'workouts', 1),
  ('ten-workouts', 'Building Momentum', 'Complete 10 workouts.', 'flame', '#FF6B35', 'training', 'workouts', 10),
  ('seven-day-streak', 'Consistency', 'Maintain a seven-day activity streak.', 'calendar', '#D6A84B', 'streak', 'streak', 7),
  ('nutrition-week', 'Fuelled', 'Meet nutrition targets seven times.', 'leaf', '#43D17A', 'nutrition', 'nutrition_goals', 7)
on conflict do nothing;

insert into public.platform_settings (key, value, description) values
  ('maintenance_mode', 'false'::jsonb, 'Temporarily restrict member access.'),
  ('member_registration_enabled', 'true'::jsonb, 'Allow new member registrations.'),
  ('coach_applications_enabled', 'true'::jsonb, 'Allow new coach applications.'),
  ('default_currency', '"USD"'::jsonb, 'Marketplace display currency.')
on conflict (key) do nothing;

-- Realtime publication for user-facing live data.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.bookings;
