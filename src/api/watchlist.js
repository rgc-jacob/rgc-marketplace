import { supabase } from '../lib/supabase';
import { isSellerListingId } from './listings';
import { getAllFavoriteListingIds, clearAllFavorites } from '../lib/favorites';

/**
 * @returns {Promise<{ ok: boolean, rows: Array<{ listing_key: string, listing_kind: string }>, error: string|null }>}
 */
export async function getWatchlist() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, rows: [], error: 'Not signed in' };
  }

  const { data, error } = await supabase
    .from('watchlist')
    .select('listing_key, listing_kind, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getWatchlist', error);
    return { ok: false, rows: [], error: error.message };
  }
  return { ok: true, rows: data || [], error: null };
}

/**
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function addWatchlistEntry(listingKey) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !listingKey) {
    return { ok: false, error: 'Not signed in' };
  }

  const listingKind = isSellerListingId(listingKey) ? 'seller' : 'reference';
  const { error } = await supabase
    .from('watchlist')
    .upsert(
      { user_id: user.id, listing_key: listingKey, listing_kind: listingKind },
      { onConflict: 'user_id,listing_key', ignoreDuplicates: true }
    );

  if (error) {
    console.error('addWatchlistEntry', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/**
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function removeWatchlistEntry(listingKey) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !listingKey) {
    return { ok: false, error: 'Not signed in' };
  }

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_key', listingKey);

  if (error) {
    console.error('removeWatchlistEntry', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/**
 * One-time merge of locally-favorited (signed-out) listing ids into the server
 * watchlist. Safe to call on every sign-in: upsert with ignoreDuplicates makes it
 * idempotent. Clears local storage afterward so the device prefers server data.
 */
export async function mergeLocalFavoritesIntoWatchlist() {
  const localIds = getAllFavoriteListingIds();
  if (localIds.length === 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const rows = localIds.map((listingKey) => ({
    user_id: user.id,
    listing_key: listingKey,
    listing_kind: isSellerListingId(listingKey) ? 'seller' : 'reference',
  }));

  const { error } = await supabase
    .from('watchlist')
    .upsert(rows, { onConflict: 'user_id,listing_key', ignoreDuplicates: true });

  if (!error) {
    clearAllFavorites();
  } else {
    console.error('mergeLocalFavoritesIntoWatchlist', error);
  }
}

/**
 * Batched watcher counts for a page of listing keys (e.g. seller dashboard rows).
 * @param {string[]} listingKeys
 * @returns {Promise<Record<string, number>>}
 */
export async function getWatchlistCounts(listingKeys) {
  if (!listingKeys?.length) return {};
  const { data, error } = await supabase.rpc('get_watchlist_counts', {
    p_listing_keys: listingKeys,
  });
  if (error) {
    console.error('getWatchlistCounts', error);
    return {};
  }
  return Object.fromEntries((data || []).map((r) => [r.listing_key, Number(r.watcher_count)]));
}
