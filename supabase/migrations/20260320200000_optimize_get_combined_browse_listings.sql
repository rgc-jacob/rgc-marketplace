-- Fix statement timeouts: avoid get_marketplace_listings(5000) + per-row NOT EXISTS.
-- Inline reference scan with LEFT JOIN to materialized active seller (card_id, variant_name) keys
-- and cap reference candidate rows.

CREATE OR REPLACE FUNCTION public.get_combined_browse_listings(
  p_query text DEFAULT NULL,
  p_graded boolean DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_game_id text DEFAULT NULL,
  p_limit integer DEFAULT 48,
  p_offset integer DEFAULT 0
)
 RETURNS TABLE(listing_key text, source_kind text, card_id text, variant_name text, price numeric, quantity integer, recorded_at timestamptz, graded boolean, card_name text, set_name text, image_url text, game_id text, rarity text, buy_it_now boolean, best_offer boolean, seller_id uuid, description text, condition_label text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      COALESCE(e.name, c.expansion_id) AS set_name,
      COALESCE(c.image_medium, c.image_small) AS image_url,
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
      AND (p_query IS NULL OR c.name ILIKE '%' || p_query || '%' OR COALESCE(ml.title_override, '') ILIKE '%' || p_query || '%')
      AND (p_game_id IS NULL OR c.game_id = p_game_id)
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
      COALESCE(exp.name, c.expansion_id) AS set_name,
      COALESCE(c.image_medium, c.image_small) AS image_url,
      c.game_id,
      NULL::text AS rarity,
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
      AND (p_query IS NULL OR c.name ILIKE '%' || p_query || '%')
      AND (p_graded IS NULL OR p_graded = false)
      AND (p_min_price IS NULL OR lcp.price >= p_min_price)
      AND (p_max_price IS NULL OR lcp.price <= p_max_price)
      AND (p_game_id IS NULL OR c.game_id = p_game_id)
    ORDER BY lcp.updated_at DESC
    LIMIT LEAST(2000, GREATEST(p_limit + p_offset + 300, 300))
  ),
  merged AS (
    SELECT * FROM sl
    UNION ALL
    SELECT * FROM ref
  )
  SELECT * FROM merged
  ORDER BY
    CASE WHEN source_kind = 'seller' THEN 0 ELSE 1 END,
    recorded_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$function$;
