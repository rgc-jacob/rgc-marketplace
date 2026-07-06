-- ROLLBACK for the 4 Phase-1 migrations dated 2026-07-05:
--   20260705120000_add_catalog_generalization.sql
--   20260705121000_add_orders_schema_skeleton.sql
--   20260705122000_add_watchlist.sql
--   20260705123000_add_notifications.sql
--
-- NOT auto-applied. This file lives in supabase/rollbacks/, not supabase/migrations/,
-- specifically so `supabase db push` / `supabase db reset` never touches it. Run it
-- manually (paste into the Supabase SQL editor, or `psql`) only if something in Phase 1
-- needs to be undone.
--
-- Why a targeted rollback instead of restoring a full backup: this is a live,
-- shared production database with daily cron price syncs and an active mobile app
-- writing to user_cards/collections continuously. Restoring a full backup would also
-- undo all of that unrelated activity between backup and restore, not just this
-- migration. Use the backup only if data itself gets corrupted -- for "this migration
-- didn't work the way I wanted," run this script instead.
--
-- Sections are in reverse order of application (last migration first). Each section is
-- independently runnable if you only need to undo one migration, but running top to
-- bottom undoes all four cleanly (drops respect FK dependency order).

-- ============================================================
-- Undo 20260705123000_add_notifications.sql
-- ============================================================
DROP FUNCTION IF EXISTS public.create_notification(uuid, text, jsonb);
DROP TABLE IF EXISTS public.notifications;

-- ============================================================
-- Undo 20260705122000_add_watchlist.sql
-- ============================================================
DROP FUNCTION IF EXISTS public.get_watchlist_counts(text[]);
DROP TABLE IF EXISTS public.watchlist;

-- ============================================================
-- Undo 20260705121000_add_orders_schema_skeleton.sql
-- (child tables first, then parents, per FK direction)
-- ============================================================
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.order_seller_groups;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.stripe_webhook_events;
DROP TABLE IF EXISTS public.seller_payment_accounts;
DROP TABLE IF EXISTS public.buyer_payment_profiles;

-- ============================================================
-- Undo 20260705120000_add_catalog_generalization.sql
-- ============================================================
--
-- IMPORTANT: the version restored below is what was VERIFIED LIVE on RGC_Prod via the
-- Supabase MCP on 2026-07-05 (`pg_get_functiondef`), NOT the
-- 20260321220000_get_combined_browse_listings_total_count.sql file in this repo's
-- migrations folder. That file (and the three before it: ...210000, ...200000's
-- successor state, the trigram/materialized rewrite in ...140000) were apparently never
-- actually applied to production -- `list_migrations` on the live project has no record
-- of any 20260321* migration, and the live function has 18 return columns with NO
-- `total_count`, matching the simpler ...190000/...200000-era shape. Restoring the
-- 220000 file's version here would NOT be a real rollback -- it would install a
-- function that was never actually live. Always re-verify against the live database
-- with pg_get_functiondef before trusting any migration file's assumed baseline.
--
-- Postgres refuses CREATE OR REPLACE when the RETURNS TABLE column set changes (error
-- 42P13, "cannot change return type of existing function") -- confirmed live when
-- applying the forward migration on 2026-07-05. DROP FUNCTION first is required both
-- forward (18 cols -> 19 cols) and here in reverse (19 cols -> 18 cols).
DROP FUNCTION IF EXISTS public.get_combined_browse_listings(text, boolean, numeric, numeric, text, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_combined_browse_listings(
  p_query text DEFAULT NULL,
  p_graded boolean DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_game_id text DEFAULT NULL,
  p_limit integer DEFAULT 48,
  p_offset integer DEFAULT 0,
  p_query_scope text DEFAULT 'card',
  p_expansion_id text DEFAULT NULL
)
 RETURNS TABLE(
  listing_key text,
  source_kind text,
  card_id text,
  variant_name text,
  price numeric,
  quantity integer,
  recorded_at timestamptz,
  graded boolean,
  card_name text,
  set_name text,
  image_url text,
  game_id text,
  rarity text,
  buy_it_now boolean,
  best_offer boolean,
  seller_id uuid,
  description text,
  condition_label text
)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope text;
BEGIN
  v_scope := lower(btrim(coalesce(p_query_scope, 'card')));
  IF v_scope NOT IN ('card', 'set') THEN
    v_scope := 'card';
  END IF;

  IF p_query IS NULL OR btrim(p_query) = '' THEN
    RETURN QUERY
    WITH seller_keys AS MATERIALIZED (
      SELECT DISTINCT ml.card_id, ml.variant_name
      FROM public.marketplace_listings ml
      WHERE ml.status = 'active'
    ),
    sl AS (
      SELECT
        ml.id::text AS listing_key,
        'seller'::text AS source_kind,
        ml.card_id,
        ml.variant_name,
        ml.price_usd AS price,
        ml.quantity,
        ml.created_at AS recorded_at,
        false AS graded,
        c.name AS card_name,
        coalesce(e.name, c.expansion_id) AS set_name,
        coalesce(c.image_medium, c.image_small) AS image_url,
        c.game_id,
        c.rarity,
        ml.buy_it_now,
        ml.best_offer,
        ml.seller_id,
        ml.description,
        ml.condition_label
      FROM public.marketplace_listings ml
      JOIN public.cards_v2 c ON c.id = ml.card_id
      LEFT JOIN public.expansions e ON e.id = c.expansion_id
      WHERE ml.status = 'active'
        AND (p_game_id IS NULL OR c.game_id = p_game_id)
        AND (p_expansion_id IS NULL OR btrim(p_expansion_id) = '' OR c.expansion_id::text = p_expansion_id)
        AND (p_min_price IS NULL OR ml.price_usd >= p_min_price)
        AND (p_max_price IS NULL OR ml.price_usd <= p_max_price)
        AND (p_graded IS NULL OR p_graded = false)
    ),
    ref AS (
      SELECT
        lcp.card_id || '|' || lcp.variant_name AS listing_key,
        'reference'::text AS source_kind,
        lcp.card_id,
        lcp.variant_name,
        lcp.price,
        1::integer AS quantity,
        lcp.updated_at AS recorded_at,
        false AS graded,
        c.name AS card_name,
        coalesce(exp.name, c.expansion_id) AS set_name,
        coalesce(c.image_medium, c.image_small) AS image_url,
        c.game_id,
        c.rarity,
        true AS buy_it_now,
        true AS best_offer,
        NULL::uuid AS seller_id,
        NULL::text AS description,
        'Near Mint'::text AS condition_label
      FROM public.latest_card_prices_v3 lcp
      JOIN public.cards_v2 c ON c.id = lcp.card_id
      LEFT JOIN public.expansions exp ON exp.id = c.expansion_id
      LEFT JOIN seller_keys sk ON sk.card_id = lcp.card_id AND sk.variant_name = lcp.variant_name
      WHERE lcp.price IS NOT NULL
        AND lcp.price > 0
        AND sk.card_id IS NULL
        AND (p_graded IS NULL OR p_graded = false)
        AND (p_min_price IS NULL OR lcp.price >= p_min_price)
        AND (p_max_price IS NULL OR lcp.price <= p_max_price)
        AND (p_game_id IS NULL OR c.game_id = p_game_id)
        AND (p_expansion_id IS NULL OR btrim(p_expansion_id) = '' OR c.expansion_id::text = p_expansion_id)
      ORDER BY lcp.updated_at DESC
      LIMIT LEAST(2000, GREATEST(p_limit + p_offset + 300, 300))
    ),
    merged AS (
      SELECT * FROM sl
      UNION ALL
      SELECT * FROM ref
    )
    SELECT m.*
    FROM merged m
    ORDER BY
      CASE WHEN m.source_kind = 'seller' THEN 0 ELSE 1 END,
      m.recorded_at DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;

    RETURN;
  END IF;

  RETURN QUERY
  WITH seller_keys AS MATERIALIZED (
    SELECT DISTINCT ml.card_id, ml.variant_name
    FROM public.marketplace_listings ml
    WHERE ml.status = 'active'
  ),
  cards_matching_text AS MATERIALIZED (
    SELECT c.id
    FROM public.cards_v2 c
    WHERE (p_expansion_id IS NULL OR btrim(p_expansion_id) = '' OR c.expansion_id::text = p_expansion_id)
      AND (p_game_id IS NULL OR c.game_id = p_game_id)
      AND (
        (
          v_scope = 'card'
          AND (
            c.name ILIKE '%' || p_query || '%'
            OR coalesce(c.rarity, '') ILIKE '%' || p_query || '%'
            OR coalesce(c.number::text, '') ILIKE '%' || p_query || '%'
            OR coalesce(c.variant_name, '') ILIKE '%' || p_query || '%'
          )
        )
        OR (
          v_scope = 'set'
          AND c.expansion_id IS NOT NULL
          AND c.expansion_id IN (
            SELECT ex.id
            FROM public.expansions ex
            WHERE (p_game_id IS NULL OR ex.game_id = p_game_id)
              AND (
                coalesce(ex.name, '') ILIKE '%' || p_query || '%'
                OR coalesce(ex.code, '') ILIKE '%' || p_query || '%'
              )
          )
        )
      )
  ),
  sl AS (
    SELECT
      ml.id::text AS listing_key,
      'seller'::text AS source_kind,
      ml.card_id,
      ml.variant_name,
      ml.price_usd AS price,
      ml.quantity,
      ml.created_at AS recorded_at,
      false AS graded,
      c.name AS card_name,
      coalesce(e.name, c.expansion_id) AS set_name,
      coalesce(c.image_medium, c.image_small) AS image_url,
      c.game_id,
      c.rarity,
      ml.buy_it_now,
      ml.best_offer,
      ml.seller_id,
      ml.description,
      ml.condition_label
    FROM public.marketplace_listings ml
    JOIN public.cards_v2 c ON c.id = ml.card_id
    LEFT JOIN public.expansions e ON e.id = c.expansion_id
    WHERE ml.status = 'active'
      AND (
        ml.card_id IN (SELECT id FROM cards_matching_text)
        OR coalesce(ml.title_override, '') ILIKE '%' || p_query || '%'
        OR coalesce(ml.description, '') ILIKE '%' || p_query || '%'
      )
      AND (p_game_id IS NULL OR c.game_id = p_game_id)
      AND (p_expansion_id IS NULL OR btrim(p_expansion_id) = '' OR c.expansion_id::text = p_expansion_id)
      AND (p_min_price IS NULL OR ml.price_usd >= p_min_price)
      AND (p_max_price IS NULL OR ml.price_usd <= p_max_price)
      AND (p_graded IS NULL OR p_graded = false)
  ),
  ref AS (
    SELECT
      lcp.card_id || '|' || lcp.variant_name AS listing_key,
      'reference'::text AS source_kind,
      lcp.card_id,
      lcp.variant_name,
      lcp.price,
      1::integer AS quantity,
      lcp.updated_at AS recorded_at,
      false AS graded,
      c.name AS card_name,
      coalesce(exp.name, c.expansion_id) AS set_name,
      coalesce(c.image_medium, c.image_small) AS image_url,
      c.game_id,
      c.rarity,
      true AS buy_it_now,
      true AS best_offer,
      NULL::uuid AS seller_id,
      NULL::text AS description,
      'Near Mint'::text AS condition_label
    FROM public.latest_card_prices_v3 lcp
    JOIN public.cards_v2 c ON c.id = lcp.card_id
    LEFT JOIN public.expansions exp ON exp.id = c.expansion_id
    LEFT JOIN seller_keys sk ON sk.card_id = lcp.card_id AND sk.variant_name = lcp.variant_name
    WHERE lcp.price IS NOT NULL
      AND lcp.price > 0
      AND sk.card_id IS NULL
      AND lcp.card_id IN (SELECT id FROM cards_matching_text)
      AND (p_graded IS NULL OR p_graded = false)
      AND (p_min_price IS NULL OR lcp.price >= p_min_price)
      AND (p_max_price IS NULL OR lcp.price <= p_max_price)
      AND (p_game_id IS NULL OR c.game_id = p_game_id)
      AND (p_expansion_id IS NULL OR btrim(p_expansion_id) = '' OR c.expansion_id::text = p_expansion_id)
    ORDER BY lcp.updated_at DESC
    LIMIT LEAST(2000, GREATEST(p_limit + p_offset + 300, 300))
  ),
  merged AS (
    SELECT * FROM sl
    UNION ALL
    SELECT * FROM ref
  )
  SELECT m.*
  FROM merged m
  ORDER BY
    CASE WHEN m.source_kind = 'seller' THEN 0 ELSE 1 END,
    m.recorded_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_combined_browse_listings(text, boolean, numeric, numeric, text, integer, integer, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_combined_browse_listings(text, boolean, numeric, numeric, text, integer, integer, text, text) TO authenticated;

-- 2. Reverse the marketplace_listings ALTERs (child objects first).
--    NOTE: `SET NOT NULL` on card_id will fail loudly (not silently) if any row was
--    inserted with a NULL card_id in the interim (i.e. a real item-backed listing was
--    created before you rolled back) -- that is the correct, safe behavior: it forces
--    you to deal with that row instead of silently corrupting/losing it.
DROP INDEX IF EXISTS public.marketplace_listings_item_id;
ALTER TABLE public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_kind_matches_reference;
ALTER TABLE public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_reserved_within_quantity;
ALTER TABLE public.marketplace_listings DROP COLUMN IF EXISTS quantity_reserved;
ALTER TABLE public.marketplace_listings DROP COLUMN IF EXISTS listing_kind;
ALTER TABLE public.marketplace_listings DROP COLUMN IF EXISTS item_id;
ALTER TABLE public.marketplace_listings ALTER COLUMN card_id SET NOT NULL;

-- 3. Drop the generalized catalog table last (nothing references it anymore).
DROP TABLE IF EXISTS public.marketplace_items;
