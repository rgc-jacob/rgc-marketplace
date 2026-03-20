-- Seller listings + combined browse (seller rows prioritized; reference rows deduped per card/variant).
-- Applied via Supabase MCP; keep file for CLI/dashboard replay.

CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  variant_name text NOT NULL DEFAULT 'normal',
  title_override text,
  description text,
  condition_label text NOT NULL DEFAULT 'Near Mint',
  price_usd numeric(12,2) NOT NULL CHECK (price_usd >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  buy_it_now boolean NOT NULL DEFAULT true,
  best_offer boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled','draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_listings_active_card ON public.marketplace_listings (status, card_id, variant_name);
CREATE INDEX marketplace_listings_created ON public.marketplace_listings (created_at DESC);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_listings_select_public_active
  ON public.marketplace_listings FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE POLICY marketplace_listings_select_own
  ON public.marketplace_listings FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY marketplace_listings_insert_own
  ON public.marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY marketplace_listings_update_own
  ON public.marketplace_listings FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY marketplace_listings_delete_own
  ON public.marketplace_listings FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listings TO authenticated;

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
  WITH ref AS (
    SELECT
      gl.id AS listing_key,
      'reference'::text AS source_kind,
      gl.card_id,
      COALESCE(NULLIF(split_part(gl.id, '|', 2), ''), 'normal') AS variant_name,
      gl.price,
      1::integer AS quantity,
      gl.recorded_at,
      gl.graded,
      gl.card_name,
      gl.set_name,
      gl.image_url,
      gl.game_id,
      NULL::text AS rarity,
      true AS buy_it_now,
      true AS best_offer,
      NULL::uuid AS seller_id,
      NULL::text AS description,
      'Near Mint'::text AS condition_label
    FROM public.get_marketplace_listings(
      p_query, p_graded, p_min_price, p_max_price, p_game_id,
      5000, 0
    ) gl
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.marketplace_listings ml
      WHERE ml.status = 'active'
        AND ml.card_id = gl.card_id
        AND ml.variant_name = COALESCE(NULLIF(split_part(gl.id, '|', 2), ''), 'normal')
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

GRANT EXECUTE ON FUNCTION public.get_combined_browse_listings(text, boolean, numeric, numeric, text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_combined_browse_listings(text, boolean, numeric, numeric, text, integer, integer) TO authenticated;
