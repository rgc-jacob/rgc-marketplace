# RGC Marketplace — Architecture

A simplified, collector-focused trading card marketplace inspired by eBay’s [Collectible Card Games & Accessories](https://www.ebay.com/b/Collectible-Card-Games-Accessories/2536/bn_1852210) structure, with a cleaner UX aimed at nerds and collectors.

## Design principles

- **Simplistic & intuitive**: Fewer sections than eBay; one clear path to browse and buy.
- **Collector-first**: Set codes, rarity, condition, and graded status are first-class on cards and filters.
- **No clutter**: No “You may also like”, “Limited time deals”, or dense sidebars; focus on games, categories, and listings.

## High-level architecture (eBay → RGC)

| eBay concept | RGC implementation |
|--------------|--------------------|
| Shop by game | **Home**: Game grid (Pokémon, MTG, Yu-Gi-Oh!, etc.) + **Browse** filter by game |
| Shop by category | **Home**: Category tiles (Singles, Sealed Boxes, Packs, Decks, Complete Sets, Accessories) + **Browse** filter by category |
| Best selling / New arrivals | **Home**: Single “New & trending” section (combined) |
| Left sidebar filters | **Browse**: Sidebar with Game, Category, Condition, Graded, Price range |
| Search | **Header**: Global search → `/browse?q=...` |
| Listing cards | **ListingCard**: Image, game badge, title, set code, rarity, price, condition; graded badge when applicable |
| Sort options | **Browse**: Best match, Price low/high, Newest |
| Language / Year / Buying format | Omitted for v1 (can add later) |

## Route structure

```
/                 → Home (game grid, featured listings, categories, collector CTA)
/browse           → Listings with filters (query: ?q= & game= & category= & graded= )
/listing/:id      → Listing detail (buy, watchlist, seller info)
/sell             → Sell (placeholder)
/cart             → Cart (placeholder)
/account          → Account (placeholder)
```

## Data model (conceptual)

- **Games**: id, name, slug, listing count (e.g. Pokémon TCG, Magic, Yu-Gi-Oh!).
- **Categories**: id, name, slug (Singles, Sealed Boxes, Sealed Packs, Decks & Kits, Complete Sets, Accessories).
- **Listings**: id, title, price, condition, game, category, set, setCode, rarity, graded, grade (e.g. PSA 9), image.

Filters align with eBay’s: Game, Set, Condition, Graded (Yes/No), Price range. Category and “Graded” are emphasized for collectors.

## Tech stack

- **React 19** + **Vite 8** + **react-router-dom**
- **Tailwind CSS 3** (paper/ink/foil/mint theme; DM Sans + JetBrains Mono)
- **Supabase**: `games`, `cards_v2`, `expansions`, `card_prices_current`, RPCs `get_marketplace_listings` (with `p_game_id`, `p_limit`, `p_offset`), `get_top_movers`
- **Optional RGC Fastify droplet**: `src/lib/rgcBackend.js` — smart search, suggestions, PriceCharting proxy with Edge fallbacks when `VITE_RGC_BACKEND_URL` is set
- Static categories in `src/data/games.js` (see `docs/BACKEND_INVENTORY_WEB_APPENDIX.md` for inventory alignment)

## Running the project

```bash
cd rgc-marketplace
npm install
npm run dev
```

Open the URL shown (e.g. http://localhost:5173).

## Possible next steps

- Wire header or browse to `rgcSmartSearch` / `rgcSearchSuggest` when you want mobile-parity search relevance.
- Auth and “Sell” flow (create listing).
- Watchlist and cart persistence.
- Listing detail: gallery, multiple conditions, “Similar items”.
- Optional: Set/Year filters, language, buying format (Buy It Now vs Auction) if you want closer eBay parity.
