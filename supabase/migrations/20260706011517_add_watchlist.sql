-- Server-side watchlist so a signed-in user's saved listings sync across devices and
-- (eventually) let sellers see "N people watching" a listing. src/lib/favorites.js
-- (localStorage) remains the fallback for signed-out visitors; on sign-in the client
-- merges any local favorite ids into this table (see src/api/watchlist.js).

CREATE TABLE public.watchlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Real uuid for a seller listing, or the "cardId|variant" composite string for a
  -- reference/catalog listing -- same dual shape used everywhere else in this app.
  listing_key text NOT NULL,
  listing_kind text NOT NULL DEFAULT 'seller' CHECK (listing_kind IN ('seller', 'reference')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_key)
);

CREATE INDEX watchlist_listing_key ON public.watchlist (listing_key);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY watchlist_select_own
  ON public.watchlist FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY watchlist_insert_own
  ON public.watchlist FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY watchlist_delete_own
  ON public.watchlist FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.watchlist TO authenticated;

-- Lets a seller count watchers on their own listings (Phase 2 dashboard) without
-- exposing who is watching. Read-only aggregate, no row-level data leaked.
CREATE OR REPLACE FUNCTION public.get_watchlist_counts(p_listing_keys text[])
 RETURNS TABLE(listing_key text, watcher_count bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT w.listing_key, count(*)::bigint AS watcher_count
  FROM public.watchlist w
  WHERE w.listing_key = ANY(p_listing_keys)
  GROUP BY w.listing_key;
$function$;

GRANT EXECUTE ON FUNCTION public.get_watchlist_counts(text[]) TO authenticated;
