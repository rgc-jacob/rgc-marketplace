import { supabase } from '../lib/supabase';

/** @typedef {{ ok: boolean, error?: string|null }} ApiMeta */
/** @typedef {'seller'|'reference'} ListingSource */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSellerListingId(id) {
  return typeof id === 'string' && UUID_RE.test(id.trim());
}

function mapBrowseRow(row, gameDisplayNames = {}) {
  const isSeller = row.source_kind === 'seller';
  const price = row.price != null ? Number(row.price) : 0;
  return {
    id: row.listing_key,
    card_id: row.card_id,
    source: /** @type {ListingSource} */ (isSeller ? 'seller' : 'reference'),
    title: row.card_name || '',
    price,
    condition: row.condition_label || 'Near Mint',
    game: gameDisplayNames[row.game_id] || row.game_id,
    gameSlug: row.game_id,
    set: row.set_name || null,
    setCode: null,
    rarity: row.rarity || null,
    graded: row.graded === true,
    grade: null,
    image: row.image_url || '',
    recorded_at: row.recorded_at,
    sellerId: row.seller_id,
    quantityAvailable: row.quantity ?? 1,
    buyItNow: row.buy_it_now !== false,
    bestOffer: row.best_offer === true,
    description: row.description || null,
  };
}

/**
 * Browse + home feed: seller listings first, then reference prices (deduped per card/variant).
 * @returns {Promise<{ ok: boolean, listings: Array, pageRowCount: number, mayHaveMore: boolean, error: string|null }>}
 */
export async function getBrowseListings(params = {}) {
  const {
    query = null,
    queryScope = 'card',
    graded = null,
    minPrice = null,
    maxPrice = null,
    gameId = null,
    expansionId = null,
    gameDisplayNames = {},
    limit = 50,
    offset = 0,
  } = params;

  const pageLimit = Math.min(Math.max(1, limit), 200);
  const scope = queryScope === 'set' ? 'set' : 'card';
  const exp =
    expansionId != null && String(expansionId).trim() !== '' ? String(expansionId).trim() : null;

  const { data, error } = await supabase.rpc('get_combined_browse_listings', {
    p_query: query || null,
    p_graded: graded,
    p_min_price: minPrice,
    p_max_price: maxPrice,
    p_game_id: gameId || null,
    p_limit: pageLimit,
    p_offset: offset,
    p_query_scope: scope,
    p_expansion_id: exp,
  });

  if (error) {
    console.error('get_combined_browse_listings', error);
    return {
      ok: false,
      listings: [],
      pageRowCount: 0,
      mayHaveMore: false,
      error: error.message,
    };
  }

  const rows = data || [];
  const listings = rows.map((r) => mapBrowseRow(r, gameDisplayNames));
  return {
    ok: true,
    listings,
    pageRowCount: rows.length,
    mayHaveMore: rows.length === pageLimit,
    error: null,
  };
}

/** @deprecated Use getBrowseListings — kept for call sites not yet migrated */
export async function getMarketplaceListings(params = {}) {
  return getBrowseListings(params);
}

/**
 * Single listing: seller row (UUID) or catalog reference (`card_id|variant`).
 * @returns {Promise<{ ok: boolean, data: object|null, error: string|null }>}
 */
export async function getListingById(id, gameDisplayNames = {}) {
  if (!id) {
    return { ok: false, data: null, error: 'Missing id' };
  }

  if (isSellerListingId(id)) {
    return getSellerListingById(id, gameDisplayNames);
  }

  return getReferenceListingById(id, gameDisplayNames);
}

async function getSellerListingById(id, gameDisplayNames = {}) {
  const { data: row, error } = await supabase
    .from('marketplace_listings')
    .select(
      `
      id,
      seller_id,
      card_id,
      variant_name,
      title_override,
      description,
      condition_label,
      price_usd,
      quantity,
      buy_it_now,
      best_offer,
      status,
      created_at,
      card:cards_v2 (
        id,
        game_id,
        expansion_id,
        name,
        number,
        rarity,
        image_small,
        image_medium,
        image_large,
        variant_name,
        expansions ( id, name, code )
      )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getSellerListingById', error);
    return { ok: false, data: null, error: error.message };
  }
  if (!row || row.status === 'cancelled' || row.status === 'sold') {
    return { ok: false, data: null, error: 'Listing not available.' };
  }

  const card = row.card;
  if (!card) {
    return { ok: false, data: null, error: 'Card data missing.' };
  }

  const expansion = Array.isArray(card.expansions) ? card.expansions[0] : card.expansions;

  let sellerUsername = null;
  if (row.seller_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', row.seller_id)
      .maybeSingle();
    sellerUsername = prof?.username || null;
  }

  const compositeId = `${row.card_id}|${row.variant_name || 'normal'}`;

  return {
    ok: true,
    error: null,
    data: {
      id: row.id,
      card_id: row.card_id,
      variantName: row.variant_name || 'normal',
      compositeCatalogId: compositeId,
      source: 'seller',
      title: row.title_override || card.name,
      price: row.price_usd != null ? Number(row.price_usd) : 0,
      condition: row.condition_label || 'Near Mint',
      game: gameDisplayNames[card.game_id] || card.game_id,
      gameSlug: card.game_id,
      set: expansion?.name ?? null,
      setCode: expansion?.code ?? null,
      rarity: card.rarity ?? null,
      graded: false,
      grade: null,
      image: card.image_medium || card.image_small || card.image_large || '',
      number: card.number,
      sellerId: row.seller_id,
      sellerUsername,
      quantityAvailable: row.quantity ?? 1,
      description: row.description || null,
      listing_options: {
        buyItNow: row.buy_it_now !== false,
        bestOffer: row.best_offer === true,
        auction: false,
        quantity: row.quantity ?? 1,
        currentBid: null,
        startingBid: null,
        endTime: null,
        bidCount: 0,
      },
    },
  };
}

async function getReferenceListingById(id, gameDisplayNames = {}) {
  const parts = id.split('|');
  const cardId = parts[0];
  const variantName = parts[1] || 'normal';
  if (!cardId) {
    return { ok: false, data: null, error: 'Invalid listing id' };
  }

  const [cardRes, priceRes] = await Promise.all([
    supabase
      .from('cards_v2')
      .select(
        `
        id,
        game_id,
        expansion_id,
        name,
        number,
        rarity,
        image_small,
        image_medium,
        image_large,
        variant_name,
        expansions ( id, name, code )
      `
      )
      .eq('id', cardId)
      .maybeSingle(),
    supabase
      .from('card_prices_current')
      .select('raw_nm, variant_name, psa_9, psa_10')
      .eq('card_id', cardId)
      .eq('variant_name', variantName || 'normal')
      .maybeSingle(),
  ]);

  if (cardRes.error) {
    console.error('getReferenceListingById card', cardRes.error);
    return { ok: false, data: null, error: cardRes.error.message };
  }
  const card = cardRes.data;
  if (!card) {
    return { ok: false, data: null, error: 'Card not found' };
  }

  const expansion = Array.isArray(card.expansions) ? card.expansions[0] : card.expansions;
  const priceRow = priceRes.data;
  const price = priceRow?.raw_nm != null ? Number(priceRow.raw_nm) : null;

  return {
    ok: true,
    error: null,
    data: {
      id,
      card_id: card.id,
      variantName: variantName || 'normal',
      compositeCatalogId: id,
      source: 'reference',
      title: card.name,
      price: price ?? 0,
      condition: 'Near Mint',
      game: gameDisplayNames[card.game_id] || card.game_id,
      gameSlug: card.game_id,
      set: expansion?.name ?? null,
      setCode: expansion?.code ?? null,
      rarity: card.rarity ?? null,
      graded: false,
      grade: null,
      image: card.image_medium || card.image_small || card.image_large || '',
      number: card.number,
      sellerId: null,
      sellerUsername: null,
      quantityAvailable: 1,
      description: null,
      listing_options: {
        buyItNow: true,
        bestOffer: true,
        auction: false,
        quantity: 1,
        currentBid: null,
        startingBid: null,
        endTime: null,
        bidCount: 0,
      },
    },
  };
}

/**
 * @returns {Promise<{ ok: boolean, data?: { id: string }, error?: string|null }>}
 */
export async function createSellerListing(payload) {
  const {
    cardId,
    variantName = 'normal',
    titleOverride = null,
    description = null,
    conditionLabel = 'Near Mint',
    priceUsd,
    quantity = 1,
    buyItNow = true,
    bestOffer = false,
    status = 'active',
  } = payload;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: 'You must be signed in to create a listing.' };
  }

  const price = Number(priceUsd);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: 'Enter a valid price.' };
  }

  const qty = Math.max(1, Math.min(9999, Math.floor(Number(quantity)) || 1));

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      seller_id: user.id,
      card_id: cardId,
      variant_name: variantName || 'normal',
      title_override: titleOverride || null,
      description: description || null,
      condition_label: conditionLabel || 'Near Mint',
      price_usd: price,
      quantity: qty,
      buy_it_now: buyItNow,
      best_offer: bestOffer,
      status,
    })
    .select('id')
    .single();

  if (error) {
    console.error('createSellerListing', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { id: data.id }, error: null };
}

/**
 * @returns {Promise<{ ok: boolean, error?: string|null }>}
 */
export async function updateSellerListing(listingId, patch) {
  const row = { updated_at: new Date().toISOString() };
  if (patch.titleOverride !== undefined) row.title_override = patch.titleOverride;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.conditionLabel !== undefined) row.condition_label = patch.conditionLabel;
  if (patch.priceUsd != null && patch.priceUsd !== undefined) {
    row.price_usd = Number(patch.priceUsd);
  }
  if (patch.quantity != null && patch.quantity !== undefined) {
    row.quantity = Math.max(1, Math.floor(patch.quantity));
  }
  if (patch.buyItNow !== undefined) row.buy_it_now = patch.buyItNow;
  if (patch.bestOffer !== undefined) row.best_offer = patch.bestOffer;
  if (patch.status !== undefined) row.status = patch.status;

  const { error } = await supabase.from('marketplace_listings').update(row).eq('id', listingId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/**
 * @returns {Promise<{ ok: boolean, error?: string|null }>}
 */
export async function cancelSellerListing(listingId) {
  return updateSellerListing(listingId, { status: 'cancelled' });
}

/**
 * Current user's listings (any status). Requires auth.
 * @returns {Promise<{ ok: boolean, rows: Array, error: string|null }>}
 */
export async function getMySellerListings() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, rows: [], error: 'Not signed in' };
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      `
      id,
      card_id,
      variant_name,
      title_override,
      price_usd,
      quantity,
      status,
      buy_it_now,
      best_offer,
      created_at,
      card:cards_v2 ( name, game_id, image_medium, image_small )
    `
    )
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, rows: [], error: error.message };
  }
  return { ok: true, rows: data || [], error: null };
}

/**
 * @returns {Promise<{ gainers: Array, losers: Array }>}
 */
export async function getTopMovers(limit = 5) {
  const { data, error } = await supabase.rpc('get_top_movers', {
    p_limit: limit,
  });

  if (error) {
    console.error('getTopMovers error:', error);
    return { gainers: [], losers: [] };
  }

  const result = data || { gainers: [], losers: [] };
  return {
    gainers: result.gainers || [],
    losers: result.losers || [],
  };
}
