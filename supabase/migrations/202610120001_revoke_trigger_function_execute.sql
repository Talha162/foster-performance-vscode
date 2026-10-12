-- The security advisor flags five SECURITY DEFINER functions in public as
-- callable over /rest/v1/rpc. Three of them are trigger or event-trigger
-- functions that were never meant to be part of the API surface. Postgres
-- rejects calling them directly anyway ("trigger functions can only be called
-- as triggers"), so this is surface reduction rather than a fix for a live
-- hole, but there is no reason for them to be reachable at all.
--
-- Revoking EXECUTE does not affect the triggers themselves: Postgres checks
-- that privilege when CREATE TRIGGER runs, not each time the trigger fires.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.touch_conversation() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- is_admin() and is_coach() are deliberately left alone. 66 row policies call
-- them, and a policy expression is evaluated as the querying role, so revoking
-- EXECUTE there would break authorisation across the whole schema. They also
-- disclose nothing: both take no arguments and answer a question about the
-- caller that the caller already knows the answer to.
