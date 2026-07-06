# RGC Marketplace — Knowledge Base

Deep-dive reference for the `rgc-marketplace` repo, written to support turning it into (1) a fully
functional collectibles marketplace, (2) a digital collection tracker for cards a user personally
owns, and (3) a seller dashboard. Read this alongside [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[docs/SUPABASE_INTEGRATION.md](docs/SUPABASE_INTEGRATION.md), and
[docs/BACKEND_INVENTORY_WEB_APPENDIX.md](docs/BACKEND_INVENTORY_WEB_APPENDIX.md) — this doc summarizes
and cross-references those, plus adds a gap analysis against the three product goals.

---

## 1. What this repo actually is

**rgc-marketplace is a new web storefront bolted onto an existing, much larger "RGC" product** whose
primary client is a mobile app. The Supabase project (`lzpxplmonpksvcxbirjd`) already contains:

- A card catalog (~165K rows in `cards_v2`) covering 7 games, kept fresh by cron jobs and edge
  functions (Scrydex import/sync/image pipeline, PriceCharting linking, exchange-rate updates).
- Pricing history (`card_prices_current`, `latest_card_prices_v3`, partitioned `price_history_wide`).
- User data used by the mobile app: `profiles`, `collections`, `user_cards`.

This repo's `supabase/migrations/` folder **only contains the marketplace-specific additions**:
the `p_game_id` param on `get_marketplace_listings`, the `marketplace_listings` table, and the
`get_combined_browse_listings` RPC (with several perf/search iterations). Everything else
(`games`, `cards_v2`, `expansions`, `card_prices_current`, `user_cards`, `collections`, `profiles`,
cron, edge functions) predates this repo and is shared with the mobile app.

**Implication for your plans:** you are extending a shared production schema, not greenfielding.
Changes to `user_cards`/`collections`/`profiles` need to stay compatible with whatever the mobile
app expects (column names like `card_id_v2`, `is_graded`, `grading_company`, `display_order` are
already load-bearing). New tables you add (orders, payments, offers, etc.) are safe to design
from scratch, but should follow the existing convention: RLS-first, `SECURITY DEFINER` RPCs for
anything cross-user, plain tables + policies for user-owned data.

---

## 2. Tech stack

- **React 19**, **Vite 8**, **react-router-dom 7** (client-side routing, `BrowserRouter`)
- **Tailwind CSS 3** — custom theme in [tailwind.config.js](tailwind.config.js): `paper` (bg/neutral),
  `charcoal` (skeletons/placeholders), `ink` (text), `foil` (red accent `#bf0e14`), `mint` (accent,
  currently mapped to a dusty-rose `#dc7c74`, `dark` variant equals `foil` — theme is mid-refactor,
  see §7). Fonts: DM Sans (sans), JetBrains Mono (mono, used for prices/set codes).
- **@supabase/supabase-js 2** — the only data-access dependency. No Redux/Zustand/React Query; all
  data fetching is local `useState`/`useEffect` per page/hook.
- No test framework configured (no Jest/Vitest/Playwright in `package.json`).
- ESLint 9 flat config ([eslint.config.js](eslint.config.js)) with `react-hooks` + `react-refresh` plugins.
- Deployed as a static SPA to **GitHub Pages** via `.github/workflows/deploy-github-pages.yml`
  (builds on push to `main`, sets `BASE_PATH` for the Pages subpath, copies `index.html` → `404.html`
  for client-side routing on refresh/deep-link).

No backend server lives in this repo. There's an *optional* pointer to an external Fastify
"droplet" (DigitalOcean) via `VITE_RGC_BACKEND_URL` for smarter search/pricing, with automatic
fallback to Supabase Edge Functions — see §6.

---

## 3. Route map (`src/App.jsx`)

| Route | Component | Status |
|---|---|---|
| `/` | `Home` | Live — games grid, "New & trending" (browse feed), "Top movers (7d)", static category tiles |
| `/browse` | `Browse` | Live — full filter/search/paginate against real data |
| `/listing/:id` | `ListingDetail` | Live — branches behavior by `?ctx=` (see §5.3) |
| `/sell` | `Sell` | Live but partial — only Buy-It-Now listings persist |
| `/cart` | `Cart` | Live but **local-only** (localStorage, no checkout) |
| `/account/*` | `AccountHub` → `collection` / `library` / `seller` | Live, auth-gated |
| `/watchlist` | inline placeholder in `App.jsx` | **Static placeholder**, not wired to `src/lib/favorites.js` |
| `/orders` | inline placeholder in `App.jsx` | **Static placeholder**, no backing data at all |

Note the **watchlist inconsistency**: `ListingDetail` already implements per-device favoriting
(`src/lib/favorites.js`, localStorage-backed `isFavoriteListingId`/`toggleFavoriteListingId`), and
its "Add to watchlist" button toggles that. But the `/watchlist` route is a separate dead-end
placeholder that doesn't read from `favorites.js` at all. Wiring them together is a quick early win.

---

## 4. Data layer

### 4.1 Core tables (pre-existing, shared with mobile)

| Table | Key columns | Marketplace usage |
|---|---|---|
| `games` | `id` (slug, e.g. `pokemon`, `magicthegathering`), `display_name` | Shop-by-game nav, filters |
| `expansions` | `id`, `game_id`, `name`, `code`, `release_date` | Set filter, set/code on cards |
| `cards_v2` | `id`, `game_id`, `expansion_id`, `name`, `number`, `rarity`, `image_small/medium/large`, `variant_name`, `game_data` (JSONB) | Catalog browse, listing detail |
| `card_prices_current` | `card_id`, `variant_name`, `raw_nm`, `psa_1`–`psa_10`, `bgs_*`, `cgc_*`, `trend_*` | Reference pricing, graded price columns |
| `latest_card_prices_v3` | view over `card_prices_current` + `currency_rates` (JPY→USD normalized) | Backs `get_marketplace_listings` / `get_combined_browse_listings` |
| `profiles` | `id`, `username`, `avatar_url` | Seller display name on listing detail |
| `collections` | `id`, `user_id`, `name`, `is_public`, `is_wishlist`, `display_order` | "My collection" grouping |
| `user_cards` | `user_id`, `collection_id`, `card_id`/`card_id_v2`, `variant_name`, `condition`, `is_graded`, `grade`, `grading_company`, `quantity`, `purchase_price`, `declared_value` | Personal collection inventory |

### 4.2 Marketplace-specific table (this repo's migration)

**`marketplace_listings`** (added in `20260319180000_create_marketplace_listings_and_combined_browse.sql`):

```
id uuid PK, seller_id uuid → auth.users, card_id text → cards_v2, variant_name text default 'normal',
title_override text, description text, condition_label text default 'Near Mint',
price_usd numeric(12,2) check >= 0, quantity int default 1 check >= 1,
buy_it_now bool default true, best_offer bool default false,
status text check in ('active','sold','cancelled','draft'), created_at, updated_at
```

RLS: anyone can `SELECT` where `status = 'active'`; sellers can `SELECT`/`INSERT`/`UPDATE`/`DELETE`
their own rows regardless of status. No `orders`, `payments`, `offers`, or `bids` tables exist yet —
Buy It Now / Best Offer / Auction are UI concepts only; only the listing itself is persisted.

### 4.3 RPCs used by the app

| RPC | Called from | Purpose |
|---|---|---|
| `get_marketplace_listings(p_query, p_graded, p_min_price, p_max_price, p_game_id, p_limit, p_offset)` | Legacy path, still used inside `get_combined_browse_listings`'s `ref` CTE | Reference-only (no sellers) listings from `latest_card_prices_v3` |
| `get_combined_browse_listings(p_query, p_graded, p_min_price, p_max_price, p_game_id, p_limit, p_offset, p_query_scope, p_expansion_id)` | `src/api/listings.js` → `getBrowseListings` (aliased as `getMarketplaceListings`) — used by Home, Browse, SellerDashboardPage | **The** current browse RPC. Merges seller rows (`marketplace_listings`, priority) with dedup'd reference rows (skips any card/variant that already has an active seller listing). Returns `total_count` via window function. `p_query_scope`: `'card'` (name/rarity/number/variant) vs `'set'` (expansion name/code). Bifurcates in PL/pgSQL: empty query skips the text-matching CTE entirely (perf fix — see `20260321160000_get_combined_browse_bifurcate_empty_query.sql`) |
| `get_top_movers(p_limit)` | Home, SellerDashboardPage | Returns `{ gainers: [...], losers: [...] }`, 7-day price change |
| `get_collections_with_market_stats()` | `CollectionPage` | List of the signed-in user's collections + stats |
| `get_collection_cards_filtered(p_collection_id, p_search_query, p_franchises, p_sets, p_graded_status, ..., p_sort_by, p_sort_ascending, p_limit, p_offset)` | `CollectionPage` (scoped to one collection) | Filtered/paginated cards within one collection |
| `search_user_cards_across_collections(p_user_id, p_search_query, p_franchise, p_limit, p_offset)` | `CollectionPage` ("All collections" scope) | Cross-collection search |

### 4.4 Migration history (chronological, all under `supabase/migrations/`)

The 11 migrations are almost entirely about **iterating on browse search performance**: adding
`p_game_id` → creating `marketplace_listings` + first `get_combined_browse_listings` → optimizing
→ expanding text search → adding pg_trgm GIN indexes → bifurcating empty-query path (avoid full
scans) → scoping query to card vs. set → expansion filter → trigram perf pass → adding
`total_count`. This tells you the team has already hit and fixed real scale problems on
`cards_v2` (165K rows) — any new search/filter feature should reuse the `MATERIALIZED` CTE +
bifurcation pattern rather than re-inventing it.

---

## 5. Frontend structure

### 5.1 API layer (`src/api/*.js`) — thin wrappers over `supabase-js`, no ORM

- **`listings.js`** — `getBrowseListings`/`getMarketplaceListings` (browse feed), `getListingById`
  (routes to seller-by-UUID or reference-by-`cardId|variant`), `createSellerListing`,
  `updateSellerListing`, `cancelSellerListing`, `getMySellerListings` (**exists but unused in UI —
  see §7**), `getTopMovers`.
- **`catalog.js`** — `searchCatalogCards` (full catalog search with ILIKE, used by Library page and
  nav search), `getExpansionsForGame`.
- **`collections.js`** — `getCollectionsWithMarketStats`, `getCollectionCardsFiltered`,
  `searchUserCardsAcrossCollections`.
- **`games.js`** — `getGames`.
- **`userCardActions.js`** — `addCardToUserCollection` (the *only* write path into `user_cards`;
  auto-creates a "My collection" if the user has none; no update/delete/quantity-adjust yet).

All API functions return a consistent `{ ok, data/rows, error }`-ish shape and log to
`console.error` on failure rather than throwing — UI reads `error` fields defensively.

### 5.2 Listing identity model — important, easy to get wrong

Listings have **two id shapes** and the code disambiguates by pattern:

- **Seller listing**: a UUID (`marketplace_listings.id`). Detected via `isSellerListingId()` regex
  in `src/api/listings.js`.
- **Reference (catalog) listing**: composite string `"{card_id}|{variant_name}"`, e.g.
  `OGS-5|normal`. Not a real row — synthesized from `cards_v2` + `card_prices_current`/
  `latest_card_prices_v3` at read time.

Any new feature touching listing ids (cart, favorites, offers, orders) needs to handle both shapes
— `source: 'seller' | 'reference'` is threaded through most objects for this reason.

### 5.3 Listing detail view modes (`src/lib/listingView.js`)

`ListingDetail` renders differently depending on `?ctx=`/`?view=` query param, driven by
`LISTING_VIEW = { marketplace, collection, library, trending }`:

- **marketplace** (default): Buy It Now / Best Offer / Auction UI, breadcrumb to browse, shipping/
  returns copy, "About the seller" section.
- **collection**: opened from "My collection" — shows "List on marketplace" CTA, favorite toggle,
  link to view as marketplace listing.
- **library**: opened from the full catalog search — "Add to my collection" / "Search marketplace
  for this card" actions.
- **trending**: opened from Top Movers — same actions as library, different breadcrumb/badge copy.

This is a clean pattern (one detail page, contextual actions) worth preserving as you add real
transactions — e.g. an "orders" view mode could reuse the same page skeleton.

### 5.4 Client-only persistence (no server backing yet)

- **Cart** (`src/lib/cart.js`): localStorage key `rgc-marketplace:cart-v1`, cross-tab sync via a
  `storage` listener + custom `rgc-cart` event; `useCart()` hook wraps it. No checkout endpoint.
- **Favorites** (`src/lib/favorites.js`): localStorage key `rgc-marketplace:favorite-listing-ids`,
  device-only (not tied to `user_id`, doesn't survive across devices, not visible in any "watchlist"
  page — see route table above).

### 5.5 Auth (`src/contexts/AuthContext.jsx`)

Thin wrapper over Supabase Auth: `signInWithPassword`, `signUp` (with optional `username` passed as
`auth.users` metadata — **not automatically synced to `profiles.username`**; if the mobile app
relies on `profiles` being populated, you'll need a DB trigger or an explicit insert on sign-up).
No password reset, no OAuth providers, no profile-edit UI, no email-verification handling beyond a
static message.

### 5.6 Component/page inventory

```
src/components/  Header, Footer, GameGrid, ListingCard, FilterSidebar, NavSearch
src/pages/       Home, Browse, ListingDetail, Sell, Cart
src/pages/account/ AccountHub (nested router), CollectionPage, LibraryPage,
                    SellerDashboardPage, LoginForm
src/hooks/       useGames, useCart, useDebounced, useNavSearchSuggestions
src/lib/         supabase (client), rgcBackend (Fastify+Edge search/price proxy), cart, favorites,
                 listingView, browseUrl, publicUrl
src/data/        games.js (static CATEGORIES only — games themselves come from Supabase),
                 comingSoonGames.js (yugioh, starwarsunlimited flagged "coming soon" — their
                 catalogs aren't loaded yet, so browse/library show almost nothing for them),
                 listings.js (unused mock data left over from pre-Supabase prototype — dead code)
```

`NavSearch` is the most complex component: header search with a Card/Set scope toggle, debounced
catalog hits (`searchCatalogCards`) merged with optional smart-suggest strings from
`rgcSearchSuggest` (Fastify or Edge), ranked and deduped, all routing to `/browse?...`.

---

## 6. Optional Fastify + Edge parity layer (`src/lib/rgcBackend.js`)

When `VITE_RGC_BACKEND_URL` is set, three functions try the Fastify droplet first and fall back to
Supabase Edge Functions on 5xx/network error (same request contract both ways):

- `rgcSmartSearch` → `POST /api/v1/search` / Edge `search-proxy`
- `rgcSearchSuggest` → `POST /api/v1/search/suggest` / Edge `search-proxy`
- `rgcPriceChartingRequest` (routes: `search`, `top-movers`, `product`) → `POST /api/v1/prices/*` /
  Edge `pricecharting-proxy`

Currently unset in `.env.example` (commented out) — the app runs Edge-only by default. This is
optional infrastructure inherited from the mobile app; you don't need it to ship, but it's there if
you want lower-latency smart search later.

---

## 7. Gap analysis vs. your three goals

### Goal 1 — Fully functional marketplace (buy/sell), collectibles beyond cards

**Working today:** catalog browse/search/filter/paginate, seller listing creation (Buy It Now),
listing detail, client-side cart.

**Missing for "fully functional":**
- **No checkout/payment** — Cart explicitly says "Checkout and payment capture are not connected
  yet." No Stripe/payment-provider integration anywhere in the repo.
- **No orders/transactions table** — nothing records a completed sale, so there's no order history,
  no seller "sold" state transition triggered by a real purchase (only `status` values exist:
  `active/sold/cancelled/draft`, but nothing sets `sold` automatically).
- **Best Offer has no backend** — checkbox persists to `marketplace_listings.best_offer`, but the
  "Make offer" modal in `ListingDetail` only has a UI button with no submit handler wired (no
  `offers` table, no accept/decline/counter flow).
- **Auction is entirely UI-only** — explicitly not persisted (`Sell.jsx` blocks auction-only
  listings with a validation error); no bids table, no auction close logic.
- **Watchlist/orders routes are dead placeholders** — not wired to existing `favorites.js`.
- **"Categories" beyond Singles are cosmetic** — `CATEGORIES` in `src/data/games.js` includes
  Sealed Boxes/Packs/Decks/Complete Sets/Accessories, but the DB is card-centric
  (`cards_v2`/`marketplace_listings.card_id` only); Browse's client-side category filter for
  non-singles just filters to `source === 'seller'` rows, it doesn't actually distinguish sealed
  product from singles. **To sell non-card collectibles you need a new catalog concept** — either
  a generalized `products`/`items` table (not card-specific) that `marketplace_listings` can also
  reference, or a nullable-`card_id` + `item_type` discriminator on listings.
- **No image upload for seller listings** — sellers can only list existing catalog cards with
  catalog images; there's no path to attach a photo of the actual physical item (important for
  graded cards / condition disputes, and essential once you support non-card collectibles that
  aren't in `cards_v2` at all).
- **No seller reputation/feedback** — `ListingDetail`'s "About the seller" section is placeholder
  copy ("buyers will see your username, feedback...").

### Goal 2 — Digital collection of personally owned cards

**Working today:** read-heavy `CollectionPage` (search/filter/sort across `user_cards`, backed by
RPCs already built for the mobile app), one write path (`addCardToUserCollection`, add-only, always
qty 1, always ungraded/`grading_company: 'none'`).

**Missing:**
- **No update/delete on `user_cards`** — can't edit quantity, mark as graded, set grading company/
  grade, set condition, purchase price, or declared value from the web app. All of that exists as
  columns per the Supabase integration doc, but no UI writes them.
- **No "remove from collection" or bulk actions.**
- **No manual/custom card entry** — everything must already exist in `cards_v2`; there's no way to
  log something the catalog doesn't have (relevant once you go beyond cards).
- **No collection creation/management UI** — `collections` rows are only auto-created via
  `addCardToUserCollection`'s fallback; no rename, no create-additional-collection, no
  wishlist-flagging UI (`is_wishlist` column exists but unused here).
- **No photos for graded slabs or personal condition notes** beyond catalog images.

### Goal 3 — Seller dashboard

**This is the biggest surprise finding:** `SellerDashboardPage` (`/account/seller`) is **not
actually a personal seller dashboard**. It shows marketplace-wide stats (total priced SKUs across
the whole catalog, total games, top movers) and a filterable table over **all** listings via
`getMarketplaceListings`/`getBrowseListings` — the same data Browse shows, just as a table. It is
not scoped to `seller_id = current user` anywhere.

Meanwhile, `getMySellerListings()` in `src/api/listings.js` — which *does* correctly filter by
`seller_id = auth.uid()` and includes `status` (so drafts/cancelled/sold are visible to the owner)
— **exists but is never called from any component**. Same for `updateSellerListing` and
`cancelSellerListing` — implemented, unused.

**To build the seller dashboard you actually want:**
1. Swap `SellerDashboardPage`'s listings table to call `getMySellerListings()` instead of the
   public browse feed.
2. Add edit/cancel actions per row using the already-written `updateSellerListing`/
   `cancelSellerListing`.
3. Add per-listing stats you don't have yet: views, watchers/favorites-on-this-listing (would
   require favorites to move server-side — see below), and sales (needs the orders table from
   Goal 1).
4. Once orders exist, add revenue/sold-items sections — currently impossible, no sales data model.

### Cross-cutting gaps that block all three goals

- **Favorites/watchlist need to move server-side** if you want a seller to see "N people are
  watching my listing" (currently pure localStorage, invisible to anyone else, and not even wired
  to the `/watchlist` route).
- **No orders/transactions/payments schema** — this single addition unblocks "sold" listing status,
  buyer order history, seller sales history, and revenue reporting simultaneously. Worth doing
  early since goals 1 and 3 both depend on it.
- **`profiles.username` sync** — sign-up stores `username` in auth metadata only; if you want it
  showing reliably as `@username` on listings (already coded in `getSellerListingById`), add a
  trigger or explicit insert into `profiles` on sign-up.
- **Non-card collectibles require a schema decision** — this affects the catalog (`cards_v2` is
  card-specific), listings (`marketplace_listings.card_id` is a hard FK to `cards_v2`), search
  (all RPCs join through `cards_v2`), and the "Collectibles library" (currently literally a
  card search). This is the single largest architectural change implied by "currently collectible
  cards only" — plan it before adding more card-specific features on top.

---

## 8. Practical notes for future work in this repo

- **Env required to run:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env`, see
  `.env.example`). Without them the app loads but shows "No games loaded" / "check your Supabase
  connection" everywhere — this is a `console.warn`, not a hard failure.
- **`npm run dev` / `npm run build` / `npm run lint` / `npm run preview`** — no test script exists.
- Tailwind's `mint` color is currently a **dusty rose** (`#dc7c74`), not green — don't assume the
  name matches the visual; `mint-dark` (`#bf0e14`) is identical to `foil` (`#bf0e14`). The theme
  looks mid-rename (comment in `tailwind.config.js`: "Neutral divider/borders (was pink; use
  foil/mint for accents)").
- `src/data/listings.js` is dead mock data from before Supabase was wired up — safe to delete when
  convenient, nothing imports it (`Home`/`Browse` use `src/api/listings.js`, not `src/data/listings.js`).
- Two games (`yugioh`, `starwarsunlimited`) are flagged `COMING_SOON_LIBRARY_GAME_IDS` in
  `src/data/comingSoonGames.js` — their catalogs aren't loaded in `cards_v2` yet, so browse/library
  will look broken for them until that changes; this is intentional, not a bug.
- All migrations were "applied via Supabase MCP" per their header comments and kept in-repo for
  CLI/dashboard replay — i.e., the source of truth was pushed directly to the hosted project, not
  necessarily via `supabase db push` from this repo. Confirm your workflow (CLI vs. dashboard vs.
  MCP) before assuming these files are auto-applied by CI (they are not referenced anywhere in
  `.github/workflows/`).
