# RGC Marketplace — Web client vs mobile backend inventory

This appendix extends the **RGC Mobile backend & database inventory** (e.g. `backend-endpoints-inventory-2026-03-15.md`) for the **rgc-marketplace** web app. Anything listed here is used by the Vite/React client but may be missing from the mobile-focused inventory.

---

## 1. Purpose

- The mobile inventory documents **~25 RPCs**, Fastify routes on `RGC_BACKEND_URL`, Edge fallbacks, and PostgREST usage for the iOS app.
- The marketplace web app is **Supabase-first** for its current scope and additionally relies on objects below. Document them here so audits and onboarding stay accurate.

---

## 2. Web-only or web-emphasized surfaces

### 2.1 RPC: `get_marketplace_listings`

| Item | Detail |
|------|--------|
| **Auth** | No (public read, same as other catalog-style RPCs) |
| **Parameters** | `p_query`, `p_graded`, `p_min_price`, `p_max_price`, `p_game_id` (optional; `NULL` = all games), `p_limit`, `p_offset` |
| **Returns** | `id`, `card_id`, `price`, `recorded_at`, `graded`, `card_name`, `set_name`, `image_url`, `game_id` |
| **Implementation note** | Backed by **`latest_card_prices_v3`** joined to `cards_v2` and `expansions` (not raw `card_prices_current` in the RPC). |

**Mobile parity note:** The inventory describes marketplace-style discovery via **`price_history`** PostgREST in one place; the web uses this **RPC** instead. Both are valid; align clients intentionally if you want one code path.

### 2.1b RPC: `get_combined_browse_listings` (web browse + search)

The browse page calls **`get_combined_browse_listings`**, not `get_marketplace_listings`. **`p_query`** matches (case-insensitive substring) across:

- **`cards_v2`**: `name`, `rarity`, `number`, `variant_name`, `game_id`
- **`expansions`** (joined): `name`, `code`
- **Seller rows only**: `marketplace_listings.title_override`, `description`

`NULL` or blank `p_query` returns unfiltered text matches (other filters still apply). Implemented in migrations `20260321120000_expand_combined_browse_text_search.sql`, **`20260321140000_optimize_combined_browse_search_trgm.sql`** (pg_trgm GIN indexes + UNION-based card id matching), and **`20260321160000_get_combined_browse_bifurcate_empty_query.sql`** (PL/pgSQL: when there is no search string, the text-matching CTE is not run at all — avoids full `cards_v2` scans on every browse load).

### 2.2 Table: `games`

| Item | Detail |
|------|--------|
| **Usage** | `select id, display_name order by display_name` for shop-by-game nav and labels |
| **Inventory gap** | §8 table list does not name `games`; §9 documents `game_id` string values (`pokemon`, `magicthegathering`, etc.) which match `games.id`. |

### 2.3 Listing detail pricing: `card_prices_current` vs `latest_card_prices_v3`

| Object | Web usage |
|--------|-----------|
| **`latest_card_prices_v3`** | Used inside **`get_marketplace_listings`** and related pricing RPCs; USD-normalized view over `card_prices_current` + exchange rates (see [SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md)). |
| **`card_prices_current`** | Listing detail in [`src/api/listings.js`](../src/api/listings.js) (`getListingById`) reads `raw_nm`, graded columns, and `variant_name` for a single card/variant. |

**Recommendation:** Treat **`latest_card_prices_v3`** as the canonical “display price in listings” source; use **`card_prices_current`** where you need variant-level graded columns not exposed on the view, or switch detail to the view for strict consistency.

---

## 3. Overlap with mobile inventory (already documented)

| Surface | Web usage |
|---------|-----------|
| `get_top_movers` | Home “Top movers (7d)” |
| `cards_v2`, `expansions` | Listing detail joins |
| Supabase Auth (future) | Placeholder routes; when implemented, follow inventory §1 + RLS |

---

## 4. Optional Fastify + Edge parity layer

When **`VITE_RGC_BACKEND_URL`** is set, [`src/lib/rgcBackend.js`](../src/lib/rgcBackend.js) can call the droplet for smart search; on failure it falls back to the **`search-proxy`** Edge function (same contract as mobile). See that module and [`.env.example`](../.env.example).

---

## 5. Migrations in repo

Database DDL for `get_marketplace_listings` (`p_game_id`) lives under [`supabase/migrations/`](../supabase/migrations/) for version control; apply via Supabase CLI or Dashboard as you prefer.
