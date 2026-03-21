-- Add total_count to browse RPC so clients can paginate with accurate totals (window count over full merged set).

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
  condition_label text,
  total_count bigint
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
    SELECT u.listing_key,
           u.source_kind,
           u.card_id,
           u.variant_name,
           u.price,
           u.quantity,
           u.recorded_at,
           u.graded,
           u.card_name,
           u.set_name,
           u.image_url,
           u.game_id,
           u.rarity,
           u.buy_it_now,
           u.best_offer,
           u.seller_id,
           u.description,
           u.condition_label,
           u.total_count
    FROM (
      SELECT
        m.listing_key,
        m.source_kind,
        m.card_id,
        m.variant_name,
        m.price,
        m.quantity,
        m.recorded_at,
        m.graded,
        m.card_name,
        m.set_name,
        m.image_url,
        m.game_id,
        m.rarity,
        m.buy_it_now,
        m.best_offer,
        m.seller_id,
        m.description,
        m.condition_label,
        (COUNT(*) OVER ())::bigint AS total_count
      FROM merged m
    ) u
    ORDER BY
      CASE WHEN u.source_kind = 'seller' THEN 0 ELSE 1 END,
      u.recorded_at DESC NULLS LAST
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
  SELECT u.listing_key,
         u.source_kind,
         u.card_id,
         u.variant_name,
         u.price,
         u.quantity,
         u.recorded_at,
         u.graded,
         u.card_name,
         u.set_name,
         u.image_url,
         u.game_id,
         u.rarity,
         u.buy_it_now,
         u.best_offer,
         u.seller_id,
         u.description,
         u.condition_label,
         u.total_count
  FROM (
    SELECT
      m.listing_key,
      m.source_kind,
      m.card_id,
      m.variant_name,
      m.price,
      m.quantity,
      m.recorded_at,
      m.graded,
      m.card_name,
      m.set_name,
      m.image_url,
      m.game_id,
      m.rarity,
      m.buy_it_now,
      m.best_offer,
      m.seller_id,
      m.description,
      m.condition_label,
      (COUNT(*) OVER ())::bigint AS total_count
    FROM merged m
  ) u
  ORDER BY
    CASE WHEN u.source_kind = 'seller' THEN 0 ELSE 1 END,
    u.recorded_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_combined_browse_listings(text, boolean, numeric, numeric, text, integer, integer, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_combined_browse_listings(text, boolean, numeric, numeric, text, integer, integer, text, text) TO authenticated;
