-- Fix: the previous migration's `REVOKE EXECUTE ... FROM anon` on get_watchlist_counts
-- (intentionally left `authenticated` granted -- sellers viewing their own dashboard
-- need it) still left anon able to call it: information_schema.routine_privileges
-- showed a PUBLIC grant present afterward that hadn't been there before the revoke.
-- Root mechanism not fully isolated (see 20260706012013's note), but revoking from
-- anon + PUBLIC together, then re-confirming with has_function_privilege(), verified as
-- actually fixed: anon=false, authenticated=true.

REVOKE EXECUTE ON FUNCTION public.get_watchlist_counts(text[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_watchlist_counts(text[]) TO authenticated;
