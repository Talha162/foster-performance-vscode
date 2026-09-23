create or replace function public.review_coach_application(
  p_application_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.coach_applications%rowtype;
  v_status public.application_status;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review coach applications';
  end if;

  v_status := case p_status
    when 'Submitted' then 'submitted'::public.application_status
    when 'Pending Review' then 'under_review'::public.application_status
    when 'More Information Required' then 'under_review'::public.application_status
    when 'Approved' then 'approved'::public.application_status
    when 'Rejected' then 'rejected'::public.application_status
    when 'Suspended' then 'rejected'::public.application_status
    else p_status::public.application_status
  end;

  update public.coach_applications
  set status = v_status,
      admin_notes = nullif(trim(p_admin_notes), ''),
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = p_application_id
  returning * into v_application;

  if not found then
    raise exception 'Coach application not found';
  end if;

  if p_status = 'Approved' then
    update public.profiles
    set role = 'coach', is_suspended = false
    where id = v_application.user_id;

    insert into public.coach_profiles (
      user_id, professional_title, biography, specialties, credentials,
      experience_years, virtual_sessions, in_person_sessions, service_location,
      session_30_price_cents, session_60_price_cents, session_90_price_cents
    ) values (
      v_application.user_id,
      coalesce(v_application.professional_title, ''),
      coalesce(v_application.biography, ''),
      coalesce(array(select jsonb_array_elements_text(v_application.specialties)), '{}'),
      coalesce(array(select jsonb_array_elements_text(v_application.certifications)), '{}'),
      coalesce(v_application.experience_years, 0),
      v_application.virtual_sessions,
      v_application.in_person_sessions,
      v_application.service_location,
      case when (v_application.prices->>'30') ~ '^\d+$' then (v_application.prices->>'30')::integer else null end,
      case when (v_application.prices->>'60') ~ '^\d+$' then (v_application.prices->>'60')::integer else null end,
      case when (v_application.prices->>'90') ~ '^\d+$' then (v_application.prices->>'90')::integer else null end
    )
    on conflict (user_id) do update set
      professional_title = excluded.professional_title,
      biography = excluded.biography,
      specialties = excluded.specialties,
      credentials = excluded.credentials,
      experience_years = excluded.experience_years,
      virtual_sessions = excluded.virtual_sessions,
      in_person_sessions = excluded.in_person_sessions,
      service_location = excluded.service_location,
      session_30_price_cents = excluded.session_30_price_cents,
      session_60_price_cents = excluded.session_60_price_cents,
      session_90_price_cents = excluded.session_90_price_cents;
  elsif p_status = 'Suspended' then
    update public.profiles set is_suspended = true where id = v_application.user_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'coach_application_reviewed', 'coach_application', p_application_id,
    jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.review_coach_application(uuid, text, text) from public;
grant execute on function public.review_coach_application(uuid, text, text) to authenticated;
