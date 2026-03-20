# RGC Marketplace

A simplified, collector-focused trading card marketplace inspired by eBay’s Collectible Card Games section. Built for **nerds and collectors**: clear set codes, condition, graded badges, and minimal clutter. **Data comes from your Supabase project** (games, cards, prices, top movers).

## Quick start

1. **Environment**: Copy `.env.example` to `.env` and set your Supabase keys (Project Settings → API in the dashboard):

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   Optional: `VITE_RGC_BACKEND_URL` for Fastify-first search / PriceCharting with Edge fallback (`src/lib/rgcBackend.js`). See `.env.example`.

2. **Run**:

   ```bash
   npm install
   npm run dev
   ```

   Open the URL shown (e.g. http://localhost:5173).

## What’s included

- **Home**: Shop by game (from Supabase `games`), “New & trending” from `get_marketplace_listings`, and “Top movers (7d)” from `get_top_movers`.
- **Browse**: Listings from `get_marketplace_listings` with server-side `p_game_id`, paginated pages (Prev/Next), filters (query, graded, price), and client-side sort.
- **Listing detail**: Card + set + price from `cards_v2`, `expansions`, and `card_prices_current`.
- **Account** (`/account`, Supabase Auth): **My collection** (RPC `get_collection_cards_filtered` / `search_user_cards_across_collections`), **Collectibles library** (full-text + filters on `cards_v2`), **Seller dashboard** (marketplace listing explorer + SKU stats).
- **Layout**: Header (Games/Categories from API + static categories), footer.

## Stack

- React 19, Vite 8, React Router, Tailwind CSS, **@supabase/supabase-js**
- Supabase: `games`, `expansions`, `cards_v2`, `card_prices_current`, `marketplace_listings` (seller offers), RPCs `get_marketplace_listings`, `get_combined_browse_listings`, `get_top_movers`
- **Listings API** ([`src/api/listings.js`](src/api/listings.js)): browse feed merges seller + reference prices; `getListingById` supports UUID (seller) or `cardId|variant` (reference); `createSellerListing` / `updateSellerListing` / `cancelSellerListing` / `getMySellerListings`; cart persistence in [`src/lib/cart.js`](src/lib/cart.js).

See **ARCHITECTURE.md** for design, **docs/SUPABASE_INTEGRATION.md** for Supabase usage, and **docs/BACKEND_INVENTORY_WEB_APPENDIX.md** for how this web client maps to the mobile backend inventory (RPCs, views, optional droplet).
