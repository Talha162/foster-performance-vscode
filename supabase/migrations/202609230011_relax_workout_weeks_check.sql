-- workout_programs.weeks originally required weeks > 0, but the app treats 0 as
-- a meaningful value: a program with no fixed end date. The UI renders it as
-- "Ongoing" (app/(tabs)/workouts.tsx, app/workout/[id].tsx), and two catalog
-- entries rely on it — CrossFit Style Training and Foam Rolling & Myofascial
-- Release. The constraint contradicted the data model, so widen it to allow 0
-- while still rejecting negatives.

alter table public.workout_programs drop constraint if exists workout_programs_weeks_check;
alter table public.workout_programs add constraint workout_programs_weeks_check check (weeks >= 0);
