-- Message attachments were readable only by whoever uploaded them, so the
-- person the message was sent to could never open the file. Attachments are
-- stored at <uploader_id>/<conversation_id>/<filename>, which lets the policy
-- check conversation membership from the path.
drop policy if exists message_attachments_owner_read on storage.objects;

create policy message_attachments_participant_read on storage.objects for select to authenticated using (
  bucket_id = 'message-attachments'
  and (
    owner_id = (select auth.uid()::text)
    or public.is_admin()
    or exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[2]
        and (c.member_id = (select auth.uid()) or c.coach_id = (select auth.uid()))
    )
  )
);

-- Coaches build programs from the app, and workout_programs.id is a text
-- primary key with no default, so every insert had to invent one client-side.
-- Give it a default so a coach-created program gets a stable unique id.
alter table public.workout_programs
  alter column id set default ('prog_' || replace(gen_random_uuid()::text, '-', ''));
