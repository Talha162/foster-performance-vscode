insert into public.platform_settings (key, value, description)
values ('leaderboard_points', '{"workout":100,"run_walk":75,"nutrition_goals":40,"water_goal":20,"recovery":30,"checkin":10}'::jsonb, 'Points awarded once per activity type per day.')
on conflict (key) do nothing;

create or replace function public.record_activity(p_activity_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  award integer;
  inserted_count integer;
  new_current integer;
  total_points integer;
  unlocked text[] := array[]::text[];
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = current_user_id and not is_suspended) then
    raise exception 'Account unavailable';
  end if;

  select coalesce((value ->> p_activity_type)::integer, 0)
  into award from public.platform_settings where key = 'leaderboard_points';
  if award <= 0 then raise exception 'Unsupported activity type'; end if;

  insert into public.point_transactions (user_id, activity_type, points, activity_date)
  values (current_user_id, p_activity_type, award, current_date)
  on conflict (user_id, activity_type, activity_date) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return jsonb_build_object('pointsAwarded', 0, 'newAchievements', '[]'::jsonb, 'isDuplicate', true);
  end if;

  insert into public.fp_points (user_id, total, weekly, week_start)
  values (current_user_id, award, award, date_trunc('week', current_date)::date)
  on conflict (user_id) do update set
    total = public.fp_points.total + award,
    weekly = case when public.fp_points.week_start = date_trunc('week', current_date)::date then public.fp_points.weekly + award else award end,
    week_start = date_trunc('week', current_date)::date,
    updated_at = now()
  returning total into total_points;

  insert into public.streaks (user_id, current_streak, longest_streak, last_activity_date)
  values (current_user_id, 1, 1, current_date)
  on conflict (user_id) do update set
    current_streak = case
      when public.streaks.last_activity_date = current_date then public.streaks.current_streak
      when public.streaks.last_activity_date = current_date - 1 then public.streaks.current_streak + 1
      else 1 end,
    longest_streak = greatest(public.streaks.longest_streak, case
      when public.streaks.last_activity_date = current_date then public.streaks.current_streak
      when public.streaks.last_activity_date = current_date - 1 then public.streaks.current_streak + 1
      else 1 end),
    last_activity_date = current_date,
    updated_at = now()
  returning current_streak into new_current;

  insert into public.streak_history (user_id, activity_date, completed)
  values (current_user_id, current_date, true)
  on conflict (user_id, activity_date) do update set completed = true;

  insert into public.league_memberships (user_id, league_id)
  select current_user_id, id from public.leagues where minimum_points <= total_points order by tier desc limit 1
  on conflict (user_id) do update set league_id = excluded.league_id, updated_at = now();

  if p_activity_type = 'workout' then
    update public.profiles set total_workouts = total_workouts + 1 where id = current_user_id;
  end if;
  update public.profiles set streak_days = new_current where id = current_user_id;

  insert into public.user_achievements (user_id, achievement_id)
  select current_user_id, a.id from public.achievements a
  where (a.condition_type = 'streak' and new_current >= a.condition_value)
     or (a.condition_type = 'workouts' and (select total_workouts from public.profiles where id = current_user_id) >= a.condition_value)
     or (a.condition_type = p_activity_type and (select count(*) from public.point_transactions where user_id = current_user_id and activity_type = p_activity_type) >= a.condition_value)
  on conflict do nothing;

  select coalesce(array_agg(achievement_id), array[]::text[]) into unlocked
  from public.user_achievements where user_id = current_user_id and earned_at >= now() - interval '3 seconds';

  return jsonb_build_object('pointsAwarded', award, 'newAchievements', to_jsonb(unlocked), 'isDuplicate', false);
end;
$$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.friendships set status = 'accepted', updated_at = now()
  where id = p_request_id and addressee_id = (select auth.uid()) and status = 'pending';
  if not found then raise exception 'Friend request not found'; end if;
end;
$$;

revoke all on function public.record_activity(text) from public, anon;
revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.record_activity(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
