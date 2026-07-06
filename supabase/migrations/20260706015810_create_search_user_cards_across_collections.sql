-- Fix: src/api/collections.js (rgc-marketplace) calls
-- supabase.rpc('search_user_cards_across_collections', { p_user_id, p_search_query,
-- p_franchise, p_limit, p_offset }) for the "My collection -> All collections" scope,
-- but this function did not exist anywhere in the database (confirmed via pg_proc --
-- zero rows -- and not touched by the 20260409022628 "drop dangerous export RPCs"
-- migration, which only dropped export_collection_csv/export_all_collections_csv/
-- csv_escape). PostgREST returned 404 ("could not find the function ... in the schema
-- cache") for every user hitting this scope.
--
-- Modeled on the existing get_collection_cards_filtered RPC (same SECURITY DEFINER +
-- auth.uid() scoping pattern, same cards_v2/expansions joins via card_id_v2), but
-- across ALL of the caller's collections instead of one, and returning flat
-- card_name/image_url/set_name columns (not just a card_data jsonb blob) because the
-- client's titleFromRow()/imageFromRow() helpers in CollectionPage.jsx read
-- row.card_name/row.image_url directly first, before ever falling back to card_data.
--
-- Security: p_user_id is accepted (the client always sends it as NULL) but is
-- deliberately NEVER referenced in the query -- every row is scoped to
-- auth.uid() regardless of what the caller passes, so a client can never use this to
-- read another user's collection.

CREATE OR REPLACE FUNCTION public.search_user_cards_across_collections(
  p_user_id uuid DEFAULT NULL,
  p_search_query text DEFAULT '',
  p_franchise text DEFAULT NULL,
  p_limit integer DEFAULT 48,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  card_id text,
  variant_name text,
  collection_id uuid,
  collection_name text,
  quantity integer,
  is_graded boolean,
  grade numeric,
  grading_company grading_company,
  condition card_condition,
  declared_value numeric,
  purchase_price numeric,
  card_name text,
  set_name text,
  image_url text,
  rarity text,
  game_id text,
  card_data jsonb,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    uc.id,
    uc.card_id,
    uc.variant_name,
    uc.collection_id,
    col.name AS collection_name,
    uc.quantity,
    uc.is_graded,
    uc.grade,
    uc.grading_company,
    uc.condition,
    uc.declared_value,
    uc.purchase_price,
    c.name AS card_name,
    e.name AS set_name,
    COALESCE(c.image_medium, c.image_small, c.image_large) AS image_url,
    c.rarity,
    c.game_id,
    jsonb_build_object(
      'name', c.name,
      'card_name', c.name,
      'set_name', COALESCE(e.name, ''),
      'image_url', COALESCE(c.image_medium, c.image_small),
      'image_small', c.image_small,
      'image_medium', c.image_medium,
      'image_large', c.image_large,
      'game_id', c.game_id,
      'rarity', c.rarity
    ) AS card_data,
    uc.created_at,
    (COUNT(*) OVER())::bigint AS total_count
  FROM public.user_cards uc
  LEFT JOIN public.collections col ON col.id = uc.collection_id
  LEFT JOIN public.cards_v2 c ON c.id = uc.card_id_v2
  LEFT JOIN public.expansions e ON e.id = c.expansion_id
  WHERE uc.user_id = (SELECT auth.uid())
    AND (p_search_query IS NULL OR btrim(p_search_query) = '' OR
         c.name ILIKE '%' || p_search_query || '%' OR
         e.name ILIKE '%' || p_search_query || '%' OR
         c.number ILIKE '%' || p_search_query || '%')
    AND (p_franchise IS NULL OR btrim(p_franchise) = '' OR c.game_id = p_franchise)
  ORDER BY uc.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200)
  OFFSET GREATEST(p_offset, 0);
$function$;

NOTIFY pgrst, 'reload schema';
