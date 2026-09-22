create or replace function public.start_coach_application()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set role = 'coach_applicant', updated_at = now()
  where id = current_user_id and role = 'member' and not is_suspended;

  insert into public.coach_applications (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.start_coach_application() from public, anon;
grant execute on function public.start_coach_application() to authenticated;
