-- Fix: add_notifications.sql's `REVOKE ALL ... FROM PUBLIC` on create_notification did
-- NOT actually block anon/authenticated -- verified live via has_function_privilege()
-- immediately after that migration: anon could still call create_notification, meaning
-- any unauthenticated visitor could have spammed arbitrary notifications to any user.
-- `information_schema.routine_privileges` showed anon and authenticated each had their
-- own separate explicit EXECUTE grant (in addition to a PUBLIC grant) on this project --
-- likely from Supabase's default-privilege setup granting EXECUTE to anon/authenticated
-- on every new public-schema function, independent of PUBLIC, though the exact
-- mechanism wasn't fully isolated. Revoking from all three explicitly here is what was
-- empirically confirmed (via has_function_privilege) to actually remove access.
--
-- Lesson for future internal-only SECURITY DEFINER functions in this repo: never assume
-- a REVOKE took effect -- always re-check with has_function_privilege('anon', ...) /
-- ('authenticated', ...) after, and revoke from anon, authenticated, AND PUBLIC
-- explicitly rather than relying on any single one of them.

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, jsonb) FROM anon, authenticated, PUBLIC;
