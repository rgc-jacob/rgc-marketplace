-- Adds optional p_game_id filter to marketplace listings (server-side game filter + correct pagination).
-- Applied to hosted project via Supabase MCP; keep this file in repo for CLI/dashboard replays.

CREATE OR REPLACE FUNCTION public.get_marketplace_listings(
  p_query text DEFAULT NULL::text,
  p_graded boolean DEFAULT NULL::boolean,
  p_min_price numeric DEFAULT NULL::numeric,
  p_max_price numeric DEFAULT NULL::numeric,
  p_game_id text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
 RETURNS TABLE(id text, card_id text, price numeric, recorded_at timestamp with time zone, graded boolean, card_name text, set_name text, image_url text, game_id text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    lcp.card_id || '|' || lcp.variant_name AS id,
    lcp.card_id,
    lcp.price,
    lcp.updated_at AS recorded_at,
    false AS graded,
    c.name AS card_name,
    COALESCE(e.name, c.expansion_id) AS set_name,
    COALESCE(c.image_medium, c.image_small) AS image_url,
    c.game_id
  FROM latest_card_prices_v3 lcp
  JOIN cards_v2 c ON c.id = lcp.card_id
  LEFT JOIN expansions e ON e.id = c.expansion_id
  WHERE lcp.price IS NOT NULL
    AND lcp.price > 0
    AND (p_query IS NULL OR c.name ILIKE '%' || p_query || '%')
    AND (p_graded IS NULL OR p_graded = false)
    AND (p_min_price IS NULL OR lcp.price >= p_min_price)
    AND (p_max_price IS NULL OR lcp.price <= p_max_price)
    AND (p_game_id IS NULL OR c.game_id = p_game_id)
  ORDER BY lcp.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$function$;
