# Using Your Supabase Project for RGC Marketplace Data

This document describes how the **existing** Supabase project (`lzpxplmonpksvcxbirjd`) can supply data for the RGC Marketplace **without any changes** to the Supabase project. All reads below use existing tables, views, functions, and edge functions.

---

## 1. Project overview (read via MCP)

- **Project URL**: `https://lzpxplmonpksvcxbirjd.supabase.co`
- **Games** (7): Lorcana, Magic: The Gathering, One Piece, Pokemon, Riftbound, Star Wars Unlimited, Yu-Gi-Oh!
- **Cards**: ~165K rows in `cards_v2`; ~199K current price rows in `card_prices_current`; partitioned `price_history_wide` for trends.
- **Marketplace**: A function `get_marketplace_listings()` already returns “listings” (card + price + set + image) with optional filters.

---

## 2. Database tables relevant to the marketplace

| Table | Purpose for marketplace |
|-------|-------------------------|
| **games** | Shop-by-game: `id`, `display_name`. Use for nav and filter by `game_id`. |
| **expansions** | Sets: `id`, `game_id`, `name`, `code`, `release_date`. Use for set name/code on listing cards and set filter. |
| **cards_v2** | Card catalog: `id`, `game_id`, `expansion_id`, `name`, `number`, `rarity`, `image_small` / `image_medium` / `image_large`, `variant_name`, `game_data` (JSONB). Use for browse/search and listing detail. |
| **card_prices_current** | Current prices: one row per card/variant; `raw_nm` (raw/NM price), `psa_1`–`psa_10`, `bgs_*`, `cgc_*`, etc., plus `trend_*` columns. Use for price and “graded” pricing. |
| **latest_card_prices_v3** | View over `card_prices_current` + `currency_rates`; normalizes JPY→USD. Used by `get_marketplace_listings` and `get_top_movers`. |
| **profiles** | Users: `id`, `username`, `avatar_url`. Use when you add “seller” or account to listings. |
| **user_cards** | User-owned cards: `user_id`, `collection_id`, `card_id` / `card_id_v2`, `condition`, `is_graded`, `grade`, `grading_company`, `quantity`, `purchase_price`, etc. Use when you add “sell from my collection” or P2P listings. |
| **collections** | User collections: `id`, `user_id`, `name`, `is_public`, `is_wishlist`. Use for “list from collection” or wishlist. |

No schema changes are required; the app only needs **read** access (and later, if you add selling, writes to something like `listings` or flags on `user_cards`).

---

## 3. Existing functions to use as-is

### 3.1 `get_marketplace_listings` — main browse feed

**Signature:**

```sql
get_marketplace_listings(
  p_query text DEFAULT NULL,
  p_graded boolean DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_game_id text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
```

**Returns:** `(id, card_id, price, recorded_at, graded, card_name, set_name, image_url, game_id)`.

- **id**: Composite like `card_id|variant_name` (e.g. `OGS-5|normal`).
- **price**: Raw/NM price (USD after view’s JPY conversion).
- **graded**: Currently always `false` in the function (raw listings only).
- **image_url**: From `cards_v2.image_medium` or `image_small`.

**Usage from the app:**

- **Browse page**: Call with `p_query` (search), `p_min_price` / `p_max_price`, `p_game_id` (optional), `p_limit` / `p_offset`. Map rows to your `ListingCard` (title ← `card_name` + set, set code from expansions if needed).
- **Game filter**: Pass `p_game_id` matching `games.id` (e.g. `pokemon`, `magicthegathering`) for server-side filtering. See migration `20260319120000_add_p_game_id_to_get_marketplace_listings.sql` and [BACKEND_INVENTORY_WEB_APPENDIX.md](./BACKEND_INVENTORY_WEB_APPENDIX.md).
- **Listing detail**: Use `id` (or `card_id` + `variant_name`) to fetch one row or join to `cards_v2` / `expansions` for full detail.

### 3.2 `get_top_movers` — “trending” or “top movers”

**Signature:** `get_top_movers(p_limit integer DEFAULT 5)`  
**Returns:** JSON `{ "gainers": [...], "losers": [...] }`. Each item has `card_id`, `card_name`, `set_name`, `image_url`, `franchise` (game_id), `current_price`, `previous_price`, `price_change`, `change_percent` (7d).

**Usage:** Home page “Top gainers / Top losers” or “Trending” section. Call once and render two lists.

### 3.3 `get_collections_with_market_stats` / `get_collection_total_with_market_prices`

**Usage:** When you add “My collection” or “Seller” views, these can drive collection-level market value and stats. No change needed to Supabase; call from app or a small API layer.

---

## 4. Cron jobs (no changes; useful for context)

Cron drives price and catalog freshness; the marketplace only consumes the result.

- **Price sync**: `sync-prices-daily` (3:00), `scrydex-daily-price-sync` (3:00), game-specific `scrydex-price-sync-*` and `csv-sync-*` — keep `card_prices_current` and thus `latest_card_prices_v3` up to date.
- **Partitions / aggregates**: `create-future-partitions-v3`, `aggregate-daily-to-weekly-v3`, `aggregate-weekly-to-monthly-v3`, etc. — keep `price_history_wide` and weekly/monthly tables for trends (e.g. `get_top_movers`).
- **Image pipeline**: `scrydex-image-pipeline-*` and heartbeats — keep card images populated.
- **Catalog / linking**: `monitor-pokemon-sets`, `scrydex-import-cards-catchup`, `link-cards-pricecharting`, etc. — keep cards and expansions current.

You don’t need to add or change any cron; just rely on these for fresh marketplace data.

---

## 5. Edge functions (read/invoke only)

All are **ACTIVE**. Relevant ones for the marketplace:

| Function | Use in marketplace |
|----------|--------------------|
| **Get-pokemon-cards** | Pokémon card data if you need game-specific API beyond DB. |
| **search-proxy** | Central search entry point; can proxy to DB full-text or external APIs. Use for global search in header or browse. |
| **sync-prices** | Already triggered by cron; no app change. |
| **pricecharting-proxy** | PriceCharting proxy; cron/workers use it. Optional: use for “market reference” on listing detail. |
| **scrydex-*** (import, sync, monitor, image-pipeline, orchestrator) | Catalog and price maintenance. No direct app change. |
| **update-exchange-rates** | Keeps `currency_rates` updated so `latest_card_prices_v3` USD conversion is correct. |

**Recommendation:** From the marketplace app, call **search-proxy** for search (if it matches your search model) and use **Postgres** (e.g. `get_marketplace_listings`, `cards_v2`, `expansions`) for browse, filters, and listing detail. No Supabase code changes required.

---

## 6. Mapping RGC Marketplace UI → Supabase (read-only)

| Marketplace need | Source (no Supabase changes) |
|------------------|------------------------------|
| **Shop by game** | `games` table: `id`, `display_name`. Optionally count listings per game via `get_marketplace_listings` + filter by `game_id` or a small wrapper. |
| **Shop by category** | Today DB is card/price-centric (no “Sealed Boxes” etc.). Keep static categories in the app or add a `category` on a future `listings` table; for now use “Singles” from `get_marketplace_listings`. |
| **Featured / new listings** | `get_marketplace_listings(p_limit=12, p_offset=0)` — already ordered by `updated_at DESC`. Use as “New & trending”. |
| **Browse with filters** | `get_marketplace_listings(p_query, p_graded, p_min_price, p_max_price, p_game_id, p_limit, p_offset)`. |
| **Listing detail** | By `id` from listings: load card from `cards_v2` + expansion from `expansions` (set name, code). Price from same function or `card_prices_current` / `latest_card_prices_v3`. |
| **Set code on cards** | Join `expansions.code` to listing (e.g. in a wrapper or in app: fetch expansion by `expansion_id` from `cards_v2`). |
| **Rarity** | `cards_v2.rarity` (and optionally `rarity_code`) on detail. |
| **Graded** | `get_marketplace_listings` currently returns only raw (`graded = false`). Graded prices live in `card_prices_current` (e.g. `psa_9`, `bgs_10`). You can add a “graded” listing view later that reads from those columns and exposes a “grade” label (e.g. PSA 9). |
| **Top movers / trending** | `get_top_movers(p_limit)` → gainers/losers for 7d. |
| **Search** | `search-proxy` edge function and/or full-text on `cards_v2` (e.g. `search_vector`) with a simple RPC. |

---

## 7. Suggested next steps (app-side only)

1. **Point the app at Supabase**: Add `@supabase/supabase-js`, env for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and create a client.
2. **Replace mock “listings”**: Call `rpc('get_marketplace_listings', { p_query, p_min_price, p_max_price, p_limit, p_offset })` and map the result to your existing `ListingCard` props (add `set_code` from `expansions` if you add a small join or a DB wrapper).
3. **Replace mock “games”**: Select from `games` (and optionally listing counts) for the home “Shop by game” grid.
4. **Home “trending”**: Call `rpc('get_top_movers', { p_limit: 5 })` and render gainers/losers.
5. **Listing detail**: For a given `id` (e.g. `card_id|variant_name`), fetch `cards_v2` + `expansions` (and price from `get_marketplace_listings` or `latest_card_prices_v3`) and show title, set, code, rarity, price, image.
6. **Search**: Use `search-proxy` or a Supabase RPC that queries `cards_v2.search_vector` (or `name`/`expansion_id`) and return card IDs; then use `get_marketplace_listings` or direct `cards_v2` + prices for results.

No migrations, new tables, or new cron jobs are required on Supabase; the current project already exposes the data and functions needed to back the RGC Marketplace.
