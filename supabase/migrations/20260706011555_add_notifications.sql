-- Minimal in-app notifications (no email/push in this plan -- see KNOWLEDGE.md /
-- plan Phase 4.5 "out of scope"). Written via explicit inserts from RPCs/Edge Functions
-- in later phases (offers, auctions, orders), consistent with this repo's existing
-- no-trigger style.

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.notifications TO authenticated;
-- Column-level grant: a user may only ever flip their own read_at, never rewrite
-- type/payload/user_id on a notification (the RLS policy alone wouldn't stop that,
-- since it only checks user_id matches, not which columns changed).
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
-- Deliberately no INSERT grant to authenticated: a notification is always about an
-- event caused by someone OTHER than its recipient (an offer from a buyer, a bid,
-- a paid order), so the recipient must never be able to insert it directly.

-- Internal helper used by future SECURITY DEFINER RPCs (create_offer, place_bid,
-- checkout/webhook logic) to write a notification for a *different* user than the
-- caller. Postgres grants EXECUTE on new functions to PUBLIC by default -- revoke that
-- explicitly so no authenticated client can call this directly and spam arbitrary
-- notifications; it remains callable from other SECURITY DEFINER functions because
-- those run as their owner, which retains its own implicit privileges.
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.notifications (user_id, type, payload) VALUES (p_user_id, p_type, p_payload);
$function$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, jsonb) FROM PUBLIC;
